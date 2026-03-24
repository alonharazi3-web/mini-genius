'use strict';
// Mini DOCX builder — creates real .docx files (OOXML zip) without dependencies
var DocxBuilder={

  // CRC32 lookup table
  _crcTable:null,
  _getCrcTable:function(){
    if(this._crcTable)return this._crcTable;
    var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}
    this._crcTable=t;return t;
  },
  _crc32:function(buf){
    var t=this._getCrcTable(),c=0xFFFFFFFF;
    for(var i=0;i<buf.length;i++)c=(c>>>8)^t[(c^buf[i])&0xFF];
    return(c^0xFFFFFFFF)>>>0;
  },

  // Write helpers
  _u16:function(v){return[v&0xFF,(v>>8)&0xFF];},
  _u32:function(v){return[v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF];},
  _strToUtf8:function(s){
    var enc=new TextEncoder();return enc.encode(s);
  },

  // Create a zip file from entries [{name, data}]
  _createZip:function(entries){
    var files=[];var centralDir=[];var offset=0;
    for(var i=0;i<entries.length;i++){
      var e=entries[i];
      var nameBytes=this._strToUtf8(e.name);
      var dataBytes=e.data instanceof Uint8Array?e.data:this._strToUtf8(e.data);
      var crc=this._crc32(dataBytes);
      // Local file header
      var lh=[].concat(
        [0x50,0x4B,0x03,0x04], // signature
        this._u16(20),          // version needed
        this._u16(0x0800),      // flags (UTF-8)
        this._u16(0),           // compression: STORE
        this._u16(0),this._u16(0), // mod time/date
        this._u32(crc),
        this._u32(dataBytes.length), // compressed
        this._u32(dataBytes.length), // uncompressed
        this._u16(nameBytes.length),
        this._u16(0)            // extra field length
      );
      var localHeader=new Uint8Array(lh);
      files.push(localHeader,nameBytes,dataBytes);
      // Central directory entry
      var cd=[].concat(
        [0x50,0x4B,0x01,0x02],
        this._u16(20),this._u16(20),
        this._u16(0x0800),this._u16(0),
        this._u16(0),this._u16(0),
        this._u32(crc),
        this._u32(dataBytes.length),
        this._u32(dataBytes.length),
        this._u16(nameBytes.length),
        this._u16(0),this._u16(0),this._u16(0),this._u16(0),
        this._u32(0),
        this._u32(offset)
      );
      centralDir.push(new Uint8Array(cd),nameBytes);
      offset+=localHeader.length+nameBytes.length+dataBytes.length;
    }
    var cdOffset=offset;var cdSize=0;
    for(var i=0;i<centralDir.length;i++)cdSize+=centralDir[i].length;
    // End of central directory
    var eocd=new Uint8Array([].concat(
      [0x50,0x4B,0x05,0x06],
      this._u16(0),this._u16(0),
      this._u16(entries.length),this._u16(entries.length),
      this._u32(cdSize),this._u32(cdOffset),
      this._u16(0)
    ));
    // Concatenate
    var parts=[].concat(files,centralDir,[eocd]);
    var total=0;for(var i=0;i<parts.length;i++)total+=parts[i].length;
    var result=new Uint8Array(total);var pos=0;
    for(var i=0;i<parts.length;i++){
      if(parts[i] instanceof Uint8Array)result.set(parts[i],pos);
      else result.set(new Uint8Array(parts[i]),pos);
      pos+=parts[i].length;
    }
    return result;
  },

  // Escape XML
  _esc:function(s){
    if(!s)return'';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  // Build questionnaire docx
  // sections: [{title, fields:[{label, value, detail}]}]
  // grade, result, notes: optional
  build:function(candidateName,sections,grade,result,notes){
    var esc=this._esc;
    var today=new Date().toLocaleDateString('he-IL');

    // Build document.xml body
    var body='';

    // Title
    body+='<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:bidi/></w:pPr>'
    +'<w:r><w:rPr><w:rtl/></w:rPr><w:t>שאלון טלפוני — '+esc(candidateName)+'</w:t></w:r></w:p>';

    // Date
    body+='<w:p><w:pPr><w:bidi/></w:pPr>'
    +'<w:r><w:rPr><w:rtl/></w:rPr><w:t>תאריך: '+today+'</w:t></w:r></w:p>';

    // Grade
    if(grade){
      body+='<w:p><w:pPr><w:bidi/></w:pPr>'
      +'<w:r><w:rPr><w:b/><w:sz w:val="28"/><w:rtl/></w:rPr>'
      +'<w:t>ציון: '+esc(grade)+'/7 | '+esc(result||'')+'</w:t></w:r></w:p>';
    }

    // Sections
    for(var s=0;s<sections.length;s++){
      var sec=sections[s];
      // Section heading
      body+='<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:bidi/></w:pPr>'
      +'<w:r><w:rPr><w:rtl/></w:rPr><w:t>'+esc(sec.title)+'</w:t></w:r></w:p>';

      // Table
      body+='<w:tbl><w:tblPr>'
      +'<w:tblW w:w="9000" w:type="dxa"/>'
      +'<w:tblBorders>'
      +'<w:top w:val="single" w:sz="4" w:color="CCCCCC"/>'
      +'<w:left w:val="single" w:sz="4" w:color="CCCCCC"/>'
      +'<w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>'
      +'<w:right w:val="single" w:sz="4" w:color="CCCCCC"/>'
      +'<w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>'
      +'<w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/>'
      +'</w:tblBorders><w:bidiVisual/>'
      +'</w:tblPr>';

      // Header row
      body+='<w:tr>'
      +'<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:fill="1B2A4A"/></w:tcPr>'
      +'<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:rtl/></w:rPr><w:t>שאלה</w:t></w:r></w:p></w:tc>'
      +'<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:fill="1B2A4A"/></w:tcPr>'
      +'<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:rtl/></w:rPr><w:t>תשובה</w:t></w:r></w:p></w:tc>'
      +'</w:tr>';

      // Data rows
      for(var f=0;f<sec.fields.length;f++){
        var field=sec.fields[f];
        var val=field.value||'-';
        var valColor='';
        if(val==='כן')valColor='<w:color w:val="22C55E"/>';
        else if(val==='לא')valColor='<w:color w:val="DC2626"/>';

        body+='<w:tr>'
        +'<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>'
        +'<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t>'+esc(field.label)+'</w:t></w:r></w:p></w:tc>'
        +'<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>'
        +'<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr>'+valColor+'<w:rtl/></w:rPr><w:t>'+esc(val)+'</w:t></w:r></w:p></w:tc>'
        +'</w:tr>';

        // Detail row
        if(field.detail){
          body+='<w:tr>'
          +'<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>'
          +'<w:p><w:pPr><w:bidi/></w:pPr></w:p></w:tc>'
          +'<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>'
          +'<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:i/><w:rtl/></w:rPr><w:t>'+esc(field.detail)+'</w:t></w:r></w:p></w:tc>'
          +'</w:tr>';
        }
      }
      body+='</w:tbl>';
    }

    // Notes
    if(notes){
      body+='<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:bidi/></w:pPr>'
      +'<w:r><w:rPr><w:rtl/></w:rPr><w:t>הערות</w:t></w:r></w:p>';
      body+='<w:p><w:pPr><w:bidi/></w:pPr>'
      +'<w:r><w:rPr><w:rtl/></w:rPr><w:t>'+esc(notes)+'</w:t></w:r></w:p>';
    }

    // Full document.xml
    var docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
    +' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
    +' xmlns:o="urn:schemas-microsoft-com:office:office"'
    +' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    +' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
    +' xmlns:v="urn:schemas-microsoft-com:vml"'
    +' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
    +' xmlns:w10="urn:schemas-microsoft-com:office:word"'
    +' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    +' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
    +' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"'
    +' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"'
    +' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"'
    +' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"'
    +' mc:Ignorable="w14 wp14">'
    +'<w:body>'+body
    +'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    +'<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
    +'<w:bidi/></w:sectPr>'
    +'</w:body></w:document>';

    // Styles
    var stylesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    +'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>'
    +'<w:rPr><w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'
    +'<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>'
    +'<w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>'
    +'<w:rPr><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/><w:color w:val="1B2A4A"/></w:rPr></w:style>'
    +'<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>'
    +'<w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>'
    +'<w:rPr><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="2D4A7A"/></w:rPr></w:style>'
    +'</w:styles>';

    // Content_Types
    var contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    +'<Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    +'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    +'</Types>';

    // Relationships
    var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    +'</Relationships>';

    var docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    +'</Relationships>';

    // Create zip
    var zipData=this._createZip([
      {name:'[Content_Types].xml',data:contentTypes},
      {name:'_rels/.rels',data:rels},
      {name:'word/document.xml',data:docXml},
      {name:'word/styles.xml',data:stylesXml},
      {name:'word/_rels/document.xml.rels',data:docRels}
    ]);

    return new Blob([zipData],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
};
