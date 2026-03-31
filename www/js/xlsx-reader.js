'use strict';
// XlsxReader — reads .xlsx files using native DecompressionStream for decompression
var XlsxReader={

  // Read an xlsx File/Blob → {headers:[], rows:[[]]}
  read:function(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onerror=function(){reject('Failed to read file');};
      reader.onload=function(){
        XlsxReader._parseXlsx(new Uint8Array(reader.result))
          .then(resolve).catch(reject);
      };
      reader.readAsArrayBuffer(file);
    });
  },

  async _parseXlsx(data){
    _dbg('XlsxReader: parsing '+data.length+' bytes');
    var zip=await XlsxReader._readZip(data);
    _dbg('XlsxReader: extracted '+Object.keys(zip).length+' files');

    // Shared strings
    var ss=[];
    if(zip['xl/sharedStrings.xml']){
      var doc=new DOMParser().parseFromString(zip['xl/sharedStrings.xml'],'text/xml');
      var sis=doc.getElementsByTagName('si');
      for(var i=0;i<sis.length;i++){
        var ts=sis[i].getElementsByTagName('t');
        var txt='';for(var j=0;j<ts.length;j++)txt+=(ts[j].textContent||'');
        ss.push(txt);
      }
    }
    _dbg('XlsxReader: '+ss.length+' shared strings');

    // Find first sheet
    var sheetXml=zip['xl/worksheets/sheet1.xml'];
    if(!sheetXml){
      for(var k in zip){
        if(k.match(/xl\/worksheets\/sheet\d+\.xml/)){sheetXml=zip[k];break;}
      }
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
        var val=vEl?(vEl.textContent||''):'';

        if(type==='s'&&val!==''&&parseInt(val)<ss.length){
          val=ss[parseInt(val)];
        }else if(type==='inlineStr'){
          var tEls=cell.getElementsByTagName('t');
          val='';for(var ti=0;ti<tEls.length;ti++)val+=(tEls[ti].textContent||'');
        }else if(!type&&val!==''){
          var num=parseFloat(val);
          if(!isNaN(num)&&num>40000&&num<60000){
            val=XlsxReader._serialToDate(num);
          }
        }
        rowData[colIdx]=(val||'').toString();
      }
      allRows.push(rowData);
    }

    // Convert to 2D array
    var rows=[];
    for(var r=0;r<allRows.length;r++){
      var row=[];
      for(var c=0;c<=maxCol;c++)row.push(allRows[r][c]||'');
      rows.push(row);
    }

    _dbg('XlsxReader: '+rows.length+' rows, '+(maxCol+1)+' columns');
    if(rows.length<2)return{headers:[],rows:[]};
    return{headers:rows[0],rows:rows.slice(1)};
  },

  _colToIdx:function(col){
    var idx=0;col=col.toUpperCase();
    for(var i=0;i<col.length;i++)idx=idx*26+(col.charCodeAt(i)-64);
    return idx-1;
  },

  _serialToDate:function(serial){
    var d=new Date((serial-25569)*86400000);
    var dd=('0'+d.getUTCDate()).slice(-2);
    var mm=('0'+(d.getUTCMonth()+1)).slice(-2);
    return dd+'.'+mm+'.'+d.getUTCFullYear();
  },

  // ===== ZIP reader with native DecompressionStream =====
  async _readZip(data){
    var files={};
    var view=new DataView(data.buffer,data.byteOffset,data.byteLength);

    // Find end of central directory
    var eocdPos=-1;
    for(var i=data.length-22;i>=Math.max(0,data.length-65558);i--){
      if(view.getUint32(i,true)===0x06054b50){eocdPos=i;break;}
    }
    if(eocdPos<0)throw new Error('Not a valid ZIP');

    var cdOffset=view.getUint32(eocdPos+16,true);
    var numEntries=view.getUint16(eocdPos+10,true);
    var pos=cdOffset;
    _dbg('XlsxReader ZIP: '+numEntries+' entries, cd at '+cdOffset);

    for(var e=0;e<numEntries;e++){
      if(pos+46>data.length)break;
      if(view.getUint32(pos,true)!==0x02014b50)break;

      var method=view.getUint16(pos+10,true);
      var compSize=view.getUint32(pos+20,true);
      var nameLen=view.getUint16(pos+28,true);
      var extraLen=view.getUint16(pos+30,true);
      var commentLen=view.getUint16(pos+32,true);
      var localOffset=view.getUint32(pos+42,true);
      var name=new TextDecoder().decode(data.slice(pos+46,pos+46+nameLen));
      pos+=46+nameLen+extraLen+commentLen;

      // Only XML files we need
      if(!name.endsWith('.xml')&&!name.endsWith('.rels'))continue;

      // Read local file header
      if(localOffset+30>data.length)continue;
      var lhNameLen=view.getUint16(localOffset+26,true);
      var lhExtraLen=view.getUint16(localOffset+28,true);
      var dataStart=localOffset+30+lhNameLen+lhExtraLen;
      if(dataStart+compSize>data.length)continue;

      var chunk=data.slice(dataStart,dataStart+compSize);

      try{
        if(method===0){
          files[name]=new TextDecoder().decode(chunk);
        }else if(method===8){
          var decompressed=await XlsxReader._inflate(chunk);
          files[name]=new TextDecoder().decode(decompressed);
        }
      }catch(err){
        _dbg('XlsxReader: err on '+name+': '+err);
      }
    }
    return files;
  },

  // Decompress raw deflate using native DecompressionStream
  async _inflate(compressed){
    if(typeof DecompressionStream==='undefined'){
      throw new Error('DecompressionStream not supported');
    }
    var blob=new Blob([compressed]);
    var ds=new DecompressionStream('deflate-raw');
    var decompressedStream=blob.stream().pipeThrough(ds);
    var resp=new Response(decompressedStream);
    var buf=await resp.arrayBuffer();
    return new Uint8Array(buf);
  }
};
