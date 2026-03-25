'use strict';
// Minimal XLSX reader — extracts rows from .xlsx files in the browser
// Handles: shared strings, inline strings, numbers, dates, merged content
var XlsxReader={

  // Read an xlsx File/Blob → returns {headers:[], rows:[[]]}
  read:function(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onerror=function(){reject('Failed to read file');};
      reader.onload=function(){
        try{
          var result=XlsxReader._parseXlsx(new Uint8Array(reader.result));
          resolve(result);
        }catch(e){reject('XLSX parse error: '+e.message);}
      };
      reader.readAsArrayBuffer(file);
    });
  },

  _parseXlsx:function(data){
    var zip=XlsxReader._readZip(data);
    // Read shared strings
    var ss=[];
    var ssXml=zip['xl/sharedStrings.xml'];
    if(ssXml){
      var doc=new DOMParser().parseFromString(ssXml,'text/xml');
      var sis=doc.getElementsByTagName('si');
      for(var i=0;i<sis.length;i++){
        var ts=sis[i].getElementsByTagName('t');
        var txt='';for(var j=0;j<ts.length;j++)txt+=(ts[j].textContent||'');
        ss.push(txt);
      }
    }
    // Find first sheet
    var sheetXml=zip['xl/worksheets/sheet1.xml'];
    if(!sheetXml){
      // Try to find any sheet
      for(var k in zip){if(k.match(/xl\/worksheets\/sheet\d+\.xml/)){sheetXml=zip[k];break;}}
    }
    if(!sheetXml)throw new Error('No worksheet found');

    var doc=new DOMParser().parseFromString(sheetXml,'text/xml');
    var rowEls=doc.getElementsByTagName('row');
    var allRows=[];var maxCol=0;

    for(var r=0;r<rowEls.length;r++){
      var cells=rowEls[r].getElementsByTagName('c');
      var rowData={};
      for(var ci=0;ci<cells.length;ci++){
        var cell=cells[ci];
        var ref=cell.getAttribute('r')||'';
        var colIdx=XlsxReader._colToIdx(ref.replace(/[0-9]/g,''));
        if(colIdx>maxCol)maxCol=colIdx;
        var type=cell.getAttribute('t')||'';
        var vEl=cell.getElementsByTagName('v')[0];
        var val=vEl?vEl.textContent:'';

        if(type==='s'&&val!==''&&parseInt(val)<ss.length){
          val=ss[parseInt(val)];
        }else if(type==='inlineStr'){
          var is=cell.getElementsByTagName('t');
          val='';for(var ti=0;ti<is.length;ti++)val+=(is[ti].textContent||'');
        }else if(!type&&val!==''){
          // Could be a number or date serial
          var num=parseFloat(val);
          if(!isNaN(num)&&num>40000&&num<60000){
            // Likely an Excel date serial number
            val=XlsxReader._serialToDate(num);
          }
        }
        rowData[colIdx]=val;
      }
      allRows.push(rowData);
    }

    // Convert to 2D array
    var rows=[];
    for(var r=0;r<allRows.length;r++){
      var row=[];
      for(var c=0;c<=maxCol;c++){
        row.push(allRows[r][c]||'');
      }
      rows.push(row);
    }

    if(rows.length<2)return{headers:[],rows:[]};
    return{headers:rows[0],rows:rows.slice(1)};
  },

  _colToIdx:function(col){
    var idx=0;
    for(var i=0;i<col.length;i++){
      idx=idx*26+(col.charCodeAt(i)-64);
    }
    return idx-1;
  },

  _serialToDate:function(serial){
    // Excel date serial → dd/mm/yyyy
    var d=new Date((serial-25569)*86400000);
    var dd=('0'+d.getUTCDate()).slice(-2);
    var mm=('0'+(d.getUTCMonth()+1)).slice(-2);
    var yy=d.getUTCFullYear();
    return dd+'/'+mm+'/'+yy;
  },

  // ===== Minimal ZIP reader =====
  _readZip:function(data){
    var files={};
    var view=new DataView(data.buffer);
    // Find end of central directory
    var eocdPos=-1;
    for(var i=data.length-22;i>=0;i--){
      if(view.getUint32(i,true)===0x06054b50){eocdPos=i;break;}
    }
    if(eocdPos<0)throw new Error('Not a valid ZIP file');

    var cdOffset=view.getUint32(eocdPos+16,true);
    var entries=view.getUint16(eocdPos+10,true);
    var pos=cdOffset;

    for(var e=0;e<entries;e++){
      if(view.getUint32(pos,true)!==0x02014b50)break;
      var compression=view.getUint16(pos+10,true);
      var compSize=view.getUint32(pos+20,true);
      var uncompSize=view.getUint32(pos+24,true);
      var nameLen=view.getUint16(pos+28,true);
      var extraLen=view.getUint16(pos+30,true);
      var commentLen=view.getUint16(pos+32,true);
      var localOffset=view.getUint32(pos+42,true);

      var nameBytes=data.slice(pos+46,pos+46+nameLen);
      var name=new TextDecoder().decode(nameBytes);
      pos+=46+nameLen+extraLen+commentLen;

      // Read local file header to get actual data position
      var lhPos=localOffset;
      if(view.getUint32(lhPos,true)!==0x04034b50)continue;
      var lhNameLen=view.getUint16(lhPos+26,true);
      var lhExtraLen=view.getUint16(lhPos+28,true);
      var dataStart=lhPos+30+lhNameLen+lhExtraLen;

      if(name.endsWith('.xml')||name.endsWith('.rels')){
        var fileData;
        if(compression===0){
          fileData=data.slice(dataStart,dataStart+compSize);
        }else if(compression===8){
          // Deflate — use DecompressionStream if available, else raw inflate
          try{
            fileData=XlsxReader._inflate(data.slice(dataStart,dataStart+compSize),uncompSize);
          }catch(e){continue;}
        }else{continue;}
        files[name]=new TextDecoder().decode(fileData);
      }
    }
    return files;
  },

  // Raw deflate decompression using DecompressionStream (modern browsers/WebView)
  _inflate:function(compressed,expectedSize){
    // Synchronous inflate using a manual implementation for Cordova WebView
    // Wrap raw deflate in a minimal zlib header so DecompressionStream can handle it
    // For Cordova compatibility, use a simple inflate
    // Try sync approach with a small buffer
    var out=new Uint8Array(expectedSize||compressed.length*4);
    var oPos=0;
    var bits=0,nBits=0,pos=0;

    function readBits(n){
      while(nBits<n){bits|=(compressed[pos++]||0)<<nBits;nBits+=8;}
      var v=bits&((1<<n)-1);bits>>>=n;nBits-=n;return v;
    }
    function readByte(){return readBits(8);}

    while(pos<compressed.length||nBits>0){
      var bfinal=readBits(1);
      var btype=readBits(2);

      if(btype===0){
        // Stored
        bits=0;nBits=0;
        var len=compressed[pos]|(compressed[pos+1]<<8);pos+=4;
        for(var i=0;i<len;i++){if(oPos<out.length)out[oPos++]=compressed[pos++];}
      }else if(btype===1||btype===2){
        // Fixed or dynamic Huffman
        var litLens,distLens;
        if(btype===1){
          litLens=new Uint8Array(288);distLens=new Uint8Array(32);
          for(var i=0;i<144;i++)litLens[i]=8;
          for(var i=144;i<256;i++)litLens[i]=9;
          for(var i=256;i<280;i++)litLens[i]=7;
          for(var i=280;i<288;i++)litLens[i]=8;
          for(var i=0;i<32;i++)distLens[i]=5;
        }else{
          var hlit=readBits(5)+257;
          var hdist=readBits(5)+1;
          var hclen=readBits(4)+4;
          var clOrder=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
          var clLens=new Uint8Array(19);
          for(var i=0;i<hclen;i++)clLens[clOrder[i]]=readBits(3);
          var clTree=XlsxReader._buildTree(clLens);
          var allLens=new Uint8Array(hlit+hdist);
          var ai=0;
          while(ai<hlit+hdist){
            var sym=XlsxReader._readSym(clTree,function(){return readBits(1);});
            if(sym<16){allLens[ai++]=sym;}
            else if(sym===16){var rep=readBits(2)+3;var prev=allLens[ai-1];while(rep--)allLens[ai++]=prev;}
            else if(sym===17){var rep=readBits(3)+3;while(rep--)allLens[ai++]=0;}
            else{var rep=readBits(7)+11;while(rep--)allLens[ai++]=0;}
          }
          litLens=allLens.slice(0,hlit);
          distLens=allLens.slice(hlit);
        }
        var litTree=XlsxReader._buildTree(litLens);
        var distTree=XlsxReader._buildTree(distLens);
        var lenBase=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
        var lenExtra=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
        var distBase=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
        var distExtra=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
        var readBit=function(){return readBits(1);};
        while(true){
          var sym=XlsxReader._readSym(litTree,readBit);
          if(sym===256)break;
          if(sym<256){if(oPos<out.length)out[oPos++]=sym;}
          else{
            var li=sym-257;
            var length=lenBase[li]+(lenExtra[li]?readBits(lenExtra[li]):0);
            var di=XlsxReader._readSym(distTree,readBit);
            var dist=distBase[di]+(distExtra[di]?readBits(distExtra[di]):0);
            for(var i=0;i<length;i++){if(oPos<out.length)out[oPos]=out[oPos-dist];oPos++;}
          }
        }
      }
      if(bfinal)break;
    }
    return out.slice(0,oPos);
  },

  _buildTree:function(lens){
    var maxLen=0;for(var i=0;i<lens.length;i++)if(lens[i]>maxLen)maxLen=lens[i];
    if(!maxLen)return{};
    var counts=new Uint16Array(maxLen+1);
    for(var i=0;i<lens.length;i++)if(lens[i])counts[lens[i]]++;
    var offsets=new Uint16Array(maxLen+1);
    for(var i=1;i<=maxLen;i++)offsets[i]=offsets[i-1]+counts[i-1];
    var table={};
    for(var sym=0;sym<lens.length;sym++){
      if(!lens[sym])continue;
      var code=offsets[lens[sym]]++;
      var bits='';
      for(var b=lens[sym]-1;b>=0;b--)bits+=(code>>b)&1?'1':'0';
      table[bits]=sym;
    }
    return table;
  },

  _readSym:function(tree,readBit){
    var code='';
    for(var i=0;i<25;i++){
      code+=readBit();
      if(tree[code]!==undefined)return tree[code];
    }
    return 256; // end
  }
};
