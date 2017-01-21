// main.gs
//////////

function main() {
  Logger.log('START...');
  Logger.log('Get siteHash...');
  var constants = getConstants();
  var siteDomain = constants['siteDomain'];
  var siteName = constants['siteName'];
  var site = SitesApp.getSite(siteDomain, siteName);
  var parentPage = null;
  var parentPath = '';
  var siteHash = {};
  readSiteToHash(site, siteHash, parentPage, parentPath);
  for (var key in siteHash) {
    if (siteHash.hasOwnProperty(key)) {
      logVerbose(key + " -> " + siteHash[key]['pageName']);
    }
  }
  Logger.log('Got siteHash!');
  Logger.log('');
  
  Logger.log('Get driveHash...');
  var driveSiteRootFolderId = constants['driveSiteRootFolderId'];
  var driveSiteRootFolder = DriveApp.getFolderById(driveSiteRootFolderId);
  var parentFolderPath = '';
  var driveHash = {};
  readDriveToHash(driveHash, driveSiteRootFolder, parentFolderPath);
  Logger.log('Got driveHash!');
  Logger.log('');
  
  Logger.log('Sync pages...');
  syncPages(site, siteHash, driveHash);
  Logger.log('Synced pages!');
  Logger.log('DONE!')
}



// constants.gs
///////////////

function getConstants() {
  // Returns an array of the constants you will need to set in order to
  // get this to work for your own site
  var constants = {
    'verbose':'true',
    'driveSiteRootFolderId':'0ByW5vWEXWH2oMTUxcFRrVnFLRjg',  // A folder ID in Google Drive where your site heirarchy starts
    'siteDomain':'jgs.im',
    'siteName':'jgs',
    'rebuildChance':0.02,
    'codeBlockStyle':'style="color:#999999 ; background-color:#000000 ; display:block"',
    'codeSpanStyle':'style="color:#999999 ; background-color:#000000"',
    'strongStyle':'style="color:#FFFFFF"',
    'emStyle':'style="color:#FFFFFF"',
  };
  return constants;
}



// arrayUtils.gs
////////////////

function inArray(obj, a) {
  // Is the object in the array?
    for (var i = 0; i < a.length; i++) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}



// convertDocToHtml.gs
//////////////////////

function convertDocToHtml(fileId) {
  var document = DocumentApp.openById(fileId);
  var body = document.getBody();
  var numChildren = body.getNumChildren();
  var output = [];
  var images = [];
  var listCounters = {};
  
  // Walk through all the child elements of the body.
  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    output.push(processDocItem(child, listCounters, images));
  }
  
  var html = output.join('\r');
  return html;
}

function processDocItem(item, listCounters, images) {
  var output = [];
  var prefix = "", suffix = "";
  
  if (item.getType() == DocumentApp.ElementType.PARAGRAPH) {
    // Headings
    switch (item.getHeading()) {
      case DocumentApp.ParagraphHeading.HEADING6: 
        prefix = "<h6>", suffix = "</h6>"; break;
      case DocumentApp.ParagraphHeading.HEADING5: 
        prefix = "<h5>", suffix = "</h5>"; break;
      case DocumentApp.ParagraphHeading.HEADING4:
        prefix = "<h4>", suffix = "</h4>"; break;
      case DocumentApp.ParagraphHeading.HEADING3:
        prefix = "<h3>", suffix = "</h3>"; break;
      case DocumentApp.ParagraphHeading.HEADING2:
        prefix = "<h2>", suffix = "</h2>"; break;
      case DocumentApp.ParagraphHeading.HEADING1:
        prefix = "<h1>", suffix = "</h1>"; break;
      default: 
        prefix = "<p>", suffix = "</p>";
    }
    
    if (item.getNumChildren() == 0) {
      return '';
    }
  }
  
  else if (item.getType() == DocumentApp.ElementType.INLINE_IMAGE) {
    // Inline Images
    processImage(item, images, output);
  }
  
  else if (item.getType()===DocumentApp.ElementType.LIST_ITEM) {
    // Lists
    var listItem = item;
    var gt = listItem.getGlyphType();
    var key = listItem.getListId() + '.' + listItem.getNestingLevel();
    var counter = listCounters[key] || 0;
    
    if ( counter == 0 ) {
      // First list item
      if (gt === DocumentApp.GlyphType.BULLET 
          || gt === DocumentApp.GlyphType.HOLLOW_BULLET
          || gt === DocumentApp.GlyphType.SQUARE_BULLET) {
        // Bullet list (<ul>)
        prefix = '<ul class="small"><li>', suffix = '</li>';
        // suffix += '</ul>';  // hmm TODO
      } else {
        // Ordered list (<ol>)
        prefix = "<ol><li>", suffix = "</li>";
      }
    } else {
      // Subsequent list items (2, 3... n)
      prefix = '<li>';
      suffix = '</li>';
    }
    
    if (item.isAtDocumentEnd() || item.getNextSibling().getType() != DocumentApp.ElementType.LIST_ITEM) {
      // The list has ended; add ending </ul> or </ol>
      if (gt === DocumentApp.GlyphType.BULLET
          || gt === DocumentApp.GlyphType.HOLLOW_BULLET
          || gt === DocumentApp.GlyphType.SQUARE_BULLET) {
        // End of unordered list (<ul>)
        suffix += '</ul>';
      } else {
        // End of ordered list (<ol>)
        suffix += '</ol>';
      }
    }
    
    counter++;
    listCounters[key] = counter;
  }
  
  output.push(prefix);
  
  if (item.getType() == DocumentApp.ElementType.TEXT) {
    processText(item, output);
  }
  else {
    if (item.getNumChildren) {
      var numChildren = item.getNumChildren();
      // Walk through all the child elements of the doc.
      for (var i = 0; i < numChildren; i++) {
        var child = item.getChild(i);
        output.push(processDocItem(child, listCounters, images));
      }
    }
  }
  output.push(suffix);
  return output.join('');
}


function processText(item, output) {
  var text = item.getText();
  var indices = item.getTextAttributeIndices();
  
  if (indices.length <= 1) {
    // Assuming that a whole para fully italic is a quote
    if(item.isBold()) {
      output.push('<b>' + text + '</b>');
    }
    else if(item.isItalic()) {
      output.push('<blockquote>' + text + '</blockquote>');
    }
    else if (text.trim().indexOf('http://') == 0) {
      output.push('<a href="' + text + '" rel="nofollow">' + text + '</a>');
    }
    else {
      output.push(text);
    }
  }
  else {
    
    for (var i=0; i < indices.length; i ++) {
      var partAtts = item.getAttributes(indices[i]);
      var startPos = indices[i];
      var endPos = i+1 < indices.length ? indices[i+1]: text.length;
      var partText = text.substring(startPos, endPos);
      
      Logger.log(partText);
      
      if (partAtts.ITALIC) {
        output.push('<i>');
      }
      if (partAtts.BOLD) {
        output.push('<b>');
      }
      if (partAtts.UNDERLINE) {
        output.push('<u>');
      }
      
      // If someone has written [xxx] and made this whole text some special font, like superscript
      // then treat it as a reference and make it superscript.
      // Unfortunately in Google Docs, there's no way to detect superscript
      if (partText.indexOf('[')==0 && partText[partText.length-1] == ']') {
        output.push('<sup>' + partText + '</sup>');
      }
      else if (partText.trim().indexOf('http://') == 0) {
        output.push('<a href="' + partText + '" rel="nofollow">' + partText + '</a>');
      }
      else {
        output.push(partText);
      }
      
      if (partAtts.ITALIC) {
        output.push('</i>');
      }
      if (partAtts.BOLD) {
        output.push('</b>');
      }
      if (partAtts.UNDERLINE) {
        output.push('</u>');
      }
      
    }
  }
}


function processImage(item, images, output) {
  images = images || [];
  var blob = item.getBlob();
  var contentType = blob.getContentType();
  var extension = "";
  
  if (/\/png$/.test(contentType)) {
    extension = ".png";
  } else if (/\/gif$/.test(contentType)) {
    extension = ".gif";
  } else if (/\/jpe?g$/.test(contentType)) {
    extension = ".jpg";
  } else {
    throw "Unsupported image type: "+contentType;
  }
  
  var imagePrefix = "Image_";
  var imageCounter = images.length;
  var name = imagePrefix + imageCounter + extension;
  imageCounter++;
  output.push('<img src="cid:'+name+'" />');
  images.push( {
    "blob": blob,
    "type": contentType,
    "name": name});
}



// convertDocToMd.gs
////////////////////

/*
Usage: 
  Adding this script to your doc: 
    - Tools > Script Manager > New
    - Select "Blank Project", then paste this code in and save.
  Running the script:
    - Tools > Script Manager
    - Select "ConvertToMarkdown" function.
    - Click Run button.
    - Converted doc will be mailed to you. Subject will be "[MARKDOWN_MAKER]...".
*/

function convertDocToMdTest() {
  var docId = '1-1MTyM73Rwqw_yYk2KQMnP7sZwQcsXbYOSvIQuQKAq0';
  var md = ConvertToMarkdown(docId);
  Logger.log(md);
  var converter = new Showdown.converter();
  var html = converter.makeHtml(md);
  Logger.log(html);
}


function ConvertToMarkdown(fileId) {
  var document = DocumentApp.openById(fileId);
  var body = document.getBody();
  var numChildren = body.getNumChildren();
  var text = "";
  var inSrc = false;
  var inClass = false;
  var globalImageCounter = 0;
  var globalListCounters = {};
  // edbacher: added a variable for indent in src <pre> block. Let style sheet do margin.
  var srcIndent = "";
  
  var attachments = [];
  
  // Walk through all the child elements of the doc.
  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    var result = processParagraph(i, child, inSrc, globalImageCounter, globalListCounters);
    globalImageCounter += (result && result.images) ? result.images.length : 0;
    if (result!==null) {
      if (result.sourcePretty==="start" && !inSrc) {
        inSrc=true;
        text+="<pre class=\"prettyprint\">\n";
      } else if (result.sourcePretty==="end" && inSrc) {
        inSrc=false;
        text+="</pre>\n\n";
      } else if (result.source==="start" && !inSrc) {
        inSrc=true;
        text+="<pre>\n";
      } else if (result.source==="end" && inSrc) {
        inSrc=false;
        text+="</pre>\n\n";
      } else if (result.inClass==="start" && !inClass) {
        inClass=true;
        text+="<div class=\""+result.className+"\">\n";
      } else if (result.inClass==="end" && inClass) {
        inClass=false;
        text+="</div>\n\n";
      } else if (inClass) {
        text+=result.text+"\n\n";
      } else if (inSrc) {
        text+=(srcIndent+escapeHTML(result.text)+"\n");
      } else if (result.text && result.text.length>0) {
        text+=result.text+"\n\n";
      }
      
      if (result.images && result.images.length>0) {
        for (var j=0; j<result.images.length; j++) {
          attachments.push( {
            "fileName": result.images[j].name,
            "mimeType": result.images[j].type,
            "content": result.images[j].bytes } );
        }
      }
    } else if (inSrc) { // support empty lines inside source code
      text+='\n';
    }
      
  }
  
  return text;
  
//  attachments.push({"fileName":DocumentApp.getActiveDocument().getName()+".md", "mimeType": "text/plain", "content": text});
  
//  MailApp.sendEmail(Session.getActiveUser().getEmail(), 
//                    "[MARKDOWN_MAKER] "+DocumentApp.getActiveDocument().getName(), 
//                    "Your converted markdown document is attached (converted from "+DocumentApp.getActiveDocument().getUrl()+")"+
//                    "\n\nDon't know how to use the format options? See http://github.com/mangini/gdocs2md\n",
//                    { "attachments": attachments });
}

function escapeHTML(text) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Process each child element (not just paragraphs).
function processParagraph(index, element, inSrc, imageCounter, listCounters) {
  // First, check for things that require no processing.
  if (element.getNumChildren()==0) {
    return null;
  }  
  // Punt on TOC.
  if (element.getType() === DocumentApp.ElementType.TABLE_OF_CONTENTS) {
    return {"text": "[[TOC]]"};
  }
  
  // Set up for real results.
  var result = {};
  var pOut = "";
  var textElements = [];
  var imagePrefix = "image_";
  
  // Handle Table elements. Pretty simple-minded now, but works for simple tables.
  // Note that Markdown does not process within block-level HTML, so it probably 
  // doesn't make sense to add markup within tables.
  if (element.getType() === DocumentApp.ElementType.TABLE) {
    textElements.push("<table>\n");
    var nCols = element.getChild(0).getNumCells();
    for (var i = 0; i < element.getNumChildren(); i++) {
      textElements.push("  <tr>\n");
      // process this row
      for (var j = 0; j < nCols; j++) {
        textElements.push("    <td>" + element.getChild(i).getChild(j).getText() + "</td>\n");
      }
      textElements.push("  </tr>\n");
    }
    textElements.push("</table>\n");
  }
  
  // Process various types (ElementType).
  for (var i = 0; i < element.getNumChildren(); i++) {
    var t=element.getChild(i).getType();
    
    if (t === DocumentApp.ElementType.TABLE_ROW) {
      // do nothing: already handled TABLE_ROW
    } else if (t === DocumentApp.ElementType.TEXT) {
      var txt=element.getChild(i);
      pOut += txt.getText();
      textElements.push(txt);
    } else if (t === DocumentApp.ElementType.INLINE_IMAGE) {
      result.images = result.images || [];
      var contentType = element.getChild(i).getBlob().getContentType();
      var extension = "";
      if (/\/png$/.test(contentType)) {
        extension = ".png";
      } else if (/\/gif$/.test(contentType)) {
        extension = ".gif";
      } else if (/\/jpe?g$/.test(contentType)) {
        extension = ".jpg";
      } else {
        throw "Unsupported image type: "+contentType;
      }
      var name = imagePrefix + imageCounter + extension;
      imageCounter++;
      textElements.push('![image alt text]('+name+')');
      result.images.push( {
        "bytes": element.getChild(i).getBlob().getBytes(), 
        "type": contentType, 
        "name": name});
    } else if (t === DocumentApp.ElementType.PAGE_BREAK) {
      // ignore
    } else if (t === DocumentApp.ElementType.HORIZONTAL_RULE) {
      textElements.push('* * *\n');
    } else if (t === DocumentApp.ElementType.FOOTNOTE) {
      textElements.push(' (NOTE: '+element.getChild(i).getFootnoteContents().getText()+')');
    } else {
      throw "Paragraph "+index+" of type "+element.getType()+" has an unsupported child: "
      +t+" "+(element.getChild(i)["getText"] ? element.getChild(i).getText():'')+" index="+index;
    }
  }

  if (textElements.length==0) {
    // Isn't result empty now?
    return result;
  }
  
  // evb: Add source pretty too. (And abbreviations: src and srcp.)
  // process source code block:
  if (/^\s*---\s+srcp\s*$/.test(pOut) || /^\s*---\s+source pretty\s*$/.test(pOut)) {
    result.sourcePretty = "start";
  } else if (/^\s*---\s+src\s*$/.test(pOut) || /^\s*---\s+source code\s*$/.test(pOut)) {
    result.source = "start";
  } else if (/^\s*---\s+class\s+([^ ]+)\s*$/.test(pOut)) {
    result.inClass = "start";
    result.className = RegExp.$1;
  } else if (/^\s*---\s*$/.test(pOut)) {
    result.source = "end";
    result.sourcePretty = "end";
    result.inClass = "end";
  } else if (/^\s*---\s+jsperf\s*([^ ]+)\s*$/.test(pOut)) {
    result.text = '<iframe style="width: 100%; height: 340px; overflow: hidden; border: 0;" '+
                  'src="http://www.html5rocks.com/static/jsperfview/embed.html?id='+RegExp.$1+
                  '"></iframe>';
  } else {

    prefix = findPrefix(inSrc, element, listCounters);
  
    var pOut = "";
    for (var i=0; i<textElements.length; i++) {
      pOut += processTextElement(inSrc, textElements[i]);
    }

    // replace Unicode quotation marks
    pOut = pOut.replace('\u201d', '"').replace('\u201c', '"');
 
    result.text = prefix+pOut;
  }
  
  return result;
}

// Add correct prefix to list items.
function findPrefix(inSrc, element, listCounters) {
  var prefix="";
  if (!inSrc) {
    if (element.getType()===DocumentApp.ElementType.PARAGRAPH) {
      var paragraphObj = element;
      switch (paragraphObj.getHeading()) {
        // Add a # for each heading level. No break, so we accumulate the right number.
        case DocumentApp.ParagraphHeading.HEADING6: prefix+="#";
        case DocumentApp.ParagraphHeading.HEADING5: prefix+="#";
        case DocumentApp.ParagraphHeading.HEADING4: prefix+="#";
        case DocumentApp.ParagraphHeading.HEADING3: prefix+="#";
        case DocumentApp.ParagraphHeading.HEADING2: prefix+="#";
        case DocumentApp.ParagraphHeading.HEADING1: prefix+="# ";
        default:
      }
    } else if (element.getType()===DocumentApp.ElementType.LIST_ITEM) {
      var listItem = element;
      var nesting = listItem.getNestingLevel()
      for (var i=0; i<nesting; i++) {
        prefix += "    ";
      }
      var gt = listItem.getGlyphType();
      // Bullet list (<ul>):
      if (gt === DocumentApp.GlyphType.BULLET
          || gt === DocumentApp.GlyphType.HOLLOW_BULLET
          || gt === DocumentApp.GlyphType.SQUARE_BULLET) {
        prefix += "* ";
      } else {
        // Ordered list (<ol>):
        var key = listItem.getListId() + '.' + listItem.getNestingLevel();
        var counter = listCounters[key] || 0;
        counter++;
        listCounters[key] = counter;
        prefix += counter+". ";
      }
    }
  }
  return prefix;
}

function processTextElement(inSrc, txt) {
  if (typeof(txt) === 'string') {
    return txt;
  }
  
  var pOut = txt.getText();
  if (! txt.getTextAttributeIndices) {
    return pOut;
  }
  
  var attrs=txt.getTextAttributeIndices();
  var lastOff=pOut.length;

  for (var i=attrs.length-1; i>=0; i--) {
    var off=attrs[i];
    var url=txt.getLinkUrl(off);
    var font=txt.getFontFamily(off);
    if (url) {  // start of link
      if (i>=1 && attrs[i-1]==off-1 && txt.getLinkUrl(attrs[i-1])===url) {
        // detect links that are in multiple pieces because of errors on formatting:
        i-=1;
        off=attrs[i];
        url=txt.getLinkUrl(off);
      }
      pOut=pOut.substring(0, off)+'['+pOut.substring(off, lastOff)+']('+url+')'+pOut.substring(lastOff);
    } else if (font) {
      if (!inSrc && font===font.COURIER_NEW) {
        while (i>=1 && txt.getFontFamily(attrs[i-1]) && txt.getFontFamily(attrs[i-1])===font.COURIER_NEW) {
          // detect fonts that are in multiple pieces because of errors on formatting:
          i-=1;
          off=attrs[i];
        }
        pOut=pOut.substring(0, off)+'`'+pOut.substring(off, lastOff)+'`'+pOut.substring(lastOff);
      }
    }
    if (txt.isBold(off)) {
      var d1 = d2 = "**";
      if (txt.isItalic(off)) {
        // edbacher: changed this to handle bold italic properly.
        d1 = "**_"; d2 = "_**";
      }
      pOut=pOut.substring(0, off)+d1+pOut.substring(off, lastOff)+d2+pOut.substring(lastOff);
    } else if (txt.isItalic(off)) {
      pOut=pOut.substring(0, off)+'*'+pOut.substring(off, lastOff)+'*'+pOut.substring(lastOff);
    }
    lastOff=off;
  }
  return pOut;
}



// convertDocToText.gs
//////////////////////

function testConvertDocToText() {
  var fileId = '1SksSM-R_6MOHJCwJQNvd-UQ7U3dKwPTWDn82dr9aWFo';
  var plaintext = getDocPlaintext(fileId);
  Logger.log(plaintext);
}



// convertMarkdownToHtml.gs
///////////////////////////

function convertMarkdownFileToHtml(docId) {
  var file = DriveApp.getFileById(docId);
  var fileString = file.getBlob().getDataAsString();
  var fileStringNoFancyQuotes = stripFancyQuotes(fileString);
  var converter = new Showdown.converter();
  var html = converter.makeHtml(fileStringNoFancyQuotes);
  return html;
}


function convertMarkdownDocToHtml(docId) {
  var fileMd = getDocPlaintext(docId);
  logVerbose('About to convert this string into markdown:' + fileMd);
  var converter = new Showdown.converter();
  var html = converter.makeHtml(fileMd);
  var htmlPlusEditLink = html + '<p><a target="_blank" href="' + 'https://docs.google.com/document/d/' + docId + '/edit' + '">[Edit]</a></p>';
  logVerbose('This was the result of the converstion:' + htmlPlusEditLink);
  return htmlPlusEditLink;
}

function convertMarkdownStringToHtml(fileString) {
  logVerbose('About to convert this string into markdown:' + fileString);
  var converter = new Showdown.converter();
  var html = converter.makeHtml(fileString);
  return html;
}

function testMdToStr() {
  Logger.log(convertMarkdownStringToHtml("The purpose of this document is to document colors to be used in code highlighting.\n\nDefault:\n* Foreground color: 999999 (r:153; g:153; b:153)\n* Background color: 24282a (r:36; g:40; b:42) (or 333333, websafe (r:51; g:51; b:51))\n* Font Face: PragmataPro"));
}



// readDrive.gs
///////////////

function readDriveTest() {
  var driveSiteRootFolderId = '0ByW5vWEXWH2oMTUxcFRrVnFLRjg';
  var driveSiteRootFolder = DriveApp.getFolderById(driveSiteRootFolderId);
  var driveHash = {};
  readDriveToHash(driveHash, driveSiteRootFolder, '');
  
  for (var key in driveHash) {
    if (driveHash.hasOwnProperty(key)) {
      logVerbose(key + " -> " + driveHash[key]['fileName']);
    }
  }
  

}


function readDriveToHash(driveHash, parentFolder, parentFolderPath) {
  // Reads the site into a site hashmap in the format
  // <path> : fileName:<fileName>, fileTitle<fileTitle>,
  // Where <path> is in the format "/parent-folder/child-file"
  // Pass in parent as the root folder
  // Pass in parentFolderPath as ''; it's for recursion
  
  var childFolders = parentFolder.getFolders();
  var childFiles = parentFolder.getFiles();
  var parentFolderTitle = parentFolder.getName();
  var parentFolderName = convertTitleToUrlSafe(parentFolderTitle);
  
  var parentFolderIsBlobFolder = false;
  if (parentFolderName.slice(-6) == '-blobs') {
    // This is a blobs folder, by convention
    parentFolderIsBlobFolder = true;
    logVerbose('parentFolderIsBlobFolder: true');
  }
  
  // These are the mimeTypes of supported files
  var supportedTypes = [
    'application/vnd.google-apps.document',
    'text/plain',
  ];
  
  // Ensure parent exists in driveHash
  // Needed to ensure parents are created before children are born.  For tax purposes.
  if (!driveHash[parentFolderPath] && parentFolderPath !== '' && !parentFolderIsBlobFolder) {
    // Child exists but no parent page exists (and we're not at the root) (and this isn't a blob); create a generic page in the hash.
    driveHash[parentFolderPath] = {'fileId':false, 'fileName':parentFolderName, 'fileTitle':parentFolderTitle};
  }
  
  logVerbose('Gathering all files in ' + parentFolderTitle + '...');
  while (childFiles.hasNext()) {
    var childFile = childFiles.next();
    var childFileType = childFile.getMimeType();
    
    var childFileId = childFile.getId();
    var childFileTitleLiteral = childFile.getName();  // Literally what is displayed in the drive (capitals, extensions, spaces, everything)
    var childFileTitle = removeExtFromFilename(childFileTitleLiteral);  // Everything, minus the dot and extension
    var childFileExt = extFromFilename(childFileTitleLiteral);  // The file extension
    var childFileName = convertTitleToUrlSafe(childFileTitle);  // This is the URL safe (like-this)
    var childFilePath = parentFolderPath + '/' + childFileName;
    var childFileLastUpdated = childFile.getLastUpdated();
    
    var childFileIsBlob = true;  // Defaulting to true here because I don't want to try to make any blobs into page content
    if (inArray(childFileType, supportedTypes) && !parentFolderIsBlobFolder) {
      // Filetype is supported as page content and isn't in a blob folder; mark it so (so it ends up as an attachment)
      var childFileIsBlob = false;
    }
    
    var childFileIsDraft = (childFileName.slice(-6) == '-draft') ? true : false;
    
    if (childFileIsBlob) {
      // If the child file is a blob, count the extension as part of the filename.
      //   This is because you could have, say, moose.pdf and moose.jpg attached to 
      //   the same page, but if you didn't add the path to the extension here, you'd
      //   end up with a conflicting array key.
      childFilePath = childFilePath + '.' + childFileExt;
    }
    
    logVerbose('Adding a file to the array: ' + childFilePath + ' of type: ' + childFileType);
    logVerbose('fileId:' + childFileId);
    logVerbose('fileTitleLiteral:' + childFileTitleLiteral);
    logVerbose('fileTitle:' + childFileTitle);
    logVerbose('fileExt:' + childFileExt);
    logVerbose('fileName:' + childFileName);
    logVerbose('fileLastUpdated:' + childFileLastUpdated);
    logVerbose('fileIsBlob:' + childFileIsBlob);
    logVerbose('childFileIsDraft:' + childFileIsDraft);
    
    if (!childFileIsDraft) {
      driveHash[childFilePath] = {
        'fileId':childFileId, 
        'fileTitleLiteral':childFileTitleLiteral,
        'fileTitle':childFileTitle,
        'fileExt':childFileExt,
        'fileName':childFileName, 
        'fileType':childFileType,
        'fileLastUpdated':childFileLastUpdated,
        'fileIsBlob':childFileIsBlob,
        'fileIsDraft':childFileIsDraft,
      };
    }
  }
  
  logVerbose('Gathered all files in ' + parentFolderTitle + '!');
  
  logVerbose('Recursing through subfolders...');
  var childFolders = parentFolder.getFolders();
  while (childFolders.hasNext()) {
    var childFolder = childFolders.next();
    var childFolderTitle = childFolder.getName();  // This is what is literally displayed in the drive
    var childFolderName = convertTitleToUrlSafe(childFolderTitle);  // This is the URL safe (like-this)
    var childFolderIsDraft = (childFolderName.slice(-6) == '-draft') ? true : false;
    if (!childFolderIsDraft) {
      var childFolderPath = parentFolderPath + '/' + childFolderName;
      readDriveToHash(driveHash, childFolder, childFolderPath);
    }
  }
  logVerbose('Recursed through subfolders!');
}


function getDocPlaintext(fileId) {
  var document = DocumentApp.openById(fileId);
  var body = document.getBody();
  var text = body.getText();
  var textNoFancyQuotes = stripFancyQuotes(text);
  return textNoFancyQuotes;
}



// readSite.gs
//////////////

function readSiteTest() {
  var siteDomain = 'jgs.im';
  var siteName = 'jgs';
  var site = SitesApp.getSite(siteDomain, siteName);
  var siteHash = {};
  readSiteToHash(site, siteHash, null, '');
  Logger.log('hello thar');
  Logger.log('maxPathDepth: ' + getMaxPathDepth(siteHash));
  for (var key in siteHash) {
    if (siteHash.hasOwnProperty(key)) {
      Logger.log(key + " -> " + siteHash[key]['pageName']);
    }
  }
  
  Logger.log(getParentPathFromPath('/grandparent/parent/child'));
  Logger.log(getBlobParentPathFromPath('/foo/bar/baz-blobs/moose.jpg'));
}

function readSiteToHash(site, siteHash, parent, parentPath) {
  // Reads the site into a site hashmap in the format
  // <url> : <pageName>, <pageTitle>, <pageLastUpdated>,
  // Where <url> is in the format "/parent-page/child-page"
  // Pass in parent as null; it's for recursion
  // Pass in parentPath as ''; it's for recursion
  
  if (!parent) {
    // Root of site; gather pages at root of site
    var children = site.getChildren({
      type: SitesApp.PageType.WEB_PAGE,
      start: 0,
      max: 200,
      includeDrafts: false,
      includeDeleted: false,
    });
  } else {
    // Below root of site; gather children of parent page
    var children = parent.getChildren({
      type: SitesApp.PageType.WEB_PAGE,
      start: 0,
      max: 200,
      includeDrafts: false,
      includeDeleted: false,
    });
  }
  
  var childrenLength = children.length;
  
  if (childrenLength === 0) {
    // Base case; no children found
    return;
  }
  
  for (var i = 0; i < childrenLength; i++) {
    // Put each immediate child into siteHash, then recurse
    var child = children[i];
    var childName = child.getName();
    var childTitle = child.getTitle();
    var childLastUpdated = child.getLastUpdated();
    var childPath = parentPath + '/' + childName;
    logVerbose('Adding childUrl: ' + children[i].getUrl() + ' (parent of ' + parent + ') to the siteHash');
    siteHash[childPath] = {
      'pageName':childName,
      'pageTitle':childTitle,
      'pageLastUpdated':childLastUpdated,
    };
    readSiteToHash(site, siteHash, child, childPath);
  }
}

function getMaxPathDepth(siteHash) {
  var maxDepth = 0;  // A page at /tech, for example, is at depth 0.  A page at /tech/irc is at depth 1
  var thisDepth = 0;
  for (var path in siteHash) {  // The path is the key
    if (siteHash.hasOwnProperty(path)) {
      thisDepth = getPathDepth(path);
      if (thisDepth > maxDepth) {
        maxDepth = thisDepth;
      }
    }
  }
  return maxDepth;
}

function getPathDepth(path) {
  var depth = path.substr(1).split('/').length - 1;  // A page at /tech, for example, is at depth 0.  A page at /tech/irc is at depth 1
  //Logger.log('The depth of ' + path + ' is ' + depth);
  return depth;
}

function getParentPathFromPath(path) {
  // Returns '/grandparent/parent' from '/grandparent/parent/child'
  var parentPathArray = path.substr(1).split('/');  // Get rid of leading '/'
  parentPathArray.pop();  // Eliminate child element
  var parentPath = '/' + parentPathArray.join('/');
  logVerbose('The parent of ' + path + ' is ' + parentPath);
  return parentPath;
}

function getBlobParentPathFromPath(path) {
  // blobParentPath of '/foo/bar/baz-blobs/moose.jpg' will be '/foo/bar/baz'
  var blobParentPathArray = path.substr(1).split('/');  // Get rid of leading '/'
  blobParentPathArray.pop();  // Eliminate child element; now have '/foo/bar/baz-blobs'
  var lastElementPosition = blobParentPathArray.length-1;
  var lastElement = blobParentPathArray[lastElementPosition];
  blobParentPathArray[lastElementPosition] = lastElement.substr(0, lastElement.length - '-blobs'.length);  // Now have '/foo/bar/baz'
  var blobParentPath = '/' + blobParentPathArray.join('/');
  return blobParentPath;
}

function getPageFromPath(site, path) {
  // Pass in path in format '/parent/child' and get page object out
  path = path.substr(1) // Eliminate leading '/'
  var pathArray = path.split('/');
  var page = null;
  var pathArrayLength = pathArray.length;
  if (pathArray[0] === '') {
    // No URL given; return 'home' page
    page = site.getChildByName('home');
  } else if (pathArrayLength === 1) {
    // This is a top level page
    page = site.getChildByName(pathArray[0]);
  } else {
    // Not a top level page
    for (var i = 0; i < pathArrayLength; i++) {
      if (i === 0) {
        // At top level; must get the top level page first
        page = site.getChildByName(pathArray[i]);
      } else {
        // Below top level; child page is child of current page
        page = page.getChildByName(pathArray[i]);
      }
    }
  }
  return page;
}

function getPathFromPage(site, page) {
  var siteUrlLength = site.getUrl().length;
  var pagePath = page.getUrl().substr(siteUrlLength - 1);
  // The '- 1' is because the trailing slash is in the site url
  // E.g., https://sites.google.com/a/jgs.im/jgs/
  return pagePath;
}



// showdown.gs
//////////////

//
// showdown.js -- A javascript port of Markdown.
//
// Copyright (c) 2007 John Fraser.
//
// Original Markdown Copyright (c) 2004-2005 John Gruber
//   <http://daringfireball.net/projects/markdown/>
//
// Redistributable under a BSD-style open source license.
// See license.txt for more information.
//
// The full source distribution is at:
//
//        A A L
//        T C A
//        T K B
//
//   <http://www.attacklab.net/>
//

//
// Wherever possible, Showdown is a straight, line-by-line port
// of the Perl version of Markdown.
//
// This is not a normal parser design; it's basically just a
// series of string substitutions.  It's hard to read and
// maintain this way,  but keeping Showdown close to the original
// design makes it easier to port new features.
//
// More importantly, Showdown behaves like markdown.pl in most
// edge cases.  So web applications can do client-side preview
// in Javascript, and then build identical HTML on the server.
//
// This port needs the new RegExp functionality of ECMA 262,
// 3rd Edition (i.e. Javascript 1.5).  Most modern web browsers
// should do fine.  Even with the new regular expression features,
// We do a lot of work to emulate Perl's regex functionality.
// The tricky changes in this file mostly have the "attacklab:"
// label.  Major or self-explanatory changes don't.
//
// Smart diff tools like Araxis Merge will be able to match up
// this file with markdown.pl in a useful way.  A little tweaking
// helps: in a copy of markdown.pl, replace "#" with "//" and
// replace "$text" with "text".  Be sure to ignore whitespace
// and line endings.
//


//
// Showdown usage:
//
//   var text = "Markdown *rocks*.";
//
//   var converter = new Showdown.converter();
//   var html = converter.makeHtml(text);
//
//   alert(html);
//
// Note: move the sample code to the bottom of this
// file before uncommenting it.
//
function showdownTest() {
  var converter = new Showdown.converter();
  var input = '\n#mainbody\n# An exhibit of Markdown\n\n## Lists\n\n### Ordered list\n1. Item 1\n2. A second item\n3. Number 3';
  var output = converter.makeHtml(input);
  Logger.log(output);
}


//
// Showdown namespace
//
var Showdown = {extensions: {}};

//
// forEach
//
var forEach = Showdown.forEach = function (obj, callback) {
  if (typeof obj.forEach === 'function') {
    obj.forEach(callback);
  } else {
    var i, len = obj.length;
    for (i = 0; i < len; i++) {
      callback(obj[i], i, obj);
    }
  }
};

//
// Standard extension naming
//
var stdExtName = function (s) {
  return s.replace(/[_-]||\s/g, '').toLowerCase();
};

//
// converter
//
// Wraps all "globals" so that the only thing
// exposed is makeHtml().
//
Showdown.converter = function (converter_options) {
  
  //
  // Globals:
  //
  
  // Global hashes, used by various utility routines
  var g_urls;
  var g_titles;
  var g_html_blocks;
  
  // Used to track when we're inside an ordered or unordered list
  // (see _ProcessListItems() for details):
  var g_list_level = 0;
  
  // Global extensions
  var g_lang_extensions = [];
  var g_output_modifiers = [];
  
  
  //
  // Automatic Extension Loading (node only):
  //
  if (typeof module !== 'undefined' && typeof exports !== 'undefined' && typeof require !== 'undefined') {
    var fs = require('fs');
    
    if (fs) {
      // Search extensions folder
      var extensions = fs.readdirSync((__dirname || '.') + '/extensions').filter(function (file) {
        return ~file.indexOf('.js');
      }).map(function (file) {
        return file.replace(/\.js$/, '');
      });
      // Load extensions into Showdown namespace
      Showdown.forEach(extensions, function (ext) {
        var name = stdExtName(ext);
        Showdown.extensions[name] = require('./extensions/' + ext);
      });
    }
  }
  
  this.makeHtml = function (text) {
    //
    // Main function. The order in which other subs are called here is
    // essential. Link and image substitutions need to happen before
    // _EscapeSpecialCharsWithinTagAttributes(), so that any *'s or _'s in the <a>
    // and <img> tags get encoded.
    //
    
    // Clear the global hashes. If we don't clear these, you get conflicts
    // from other articles when generating a page which contains more than
    // one article (e.g. an index page that shows the N most recent
    // articles):
    g_urls = {};
    g_titles = {};
    g_html_blocks = [];
    
    // attacklab: Replace ~ with ~T
    // This lets us use tilde as an escape char to avoid md5 hashes
    // The choice of character is arbitray; anything that isn't
    // magic in Markdown will work.
    text = text.replace(/~/g, "~T");
    
    // attacklab: Replace $ with ~D
    // RegExp interprets $ as a special character
    // when it's in a replacement string
    text = text.replace(/\$/g, "~D");
    
    // Standardize line endings
    text = text.replace(/\r\n/g, "\n"); // DOS to Unix
    text = text.replace(/\r/g, "\n"); // Mac to Unix
    
    // Make sure text begins and ends with a couple of newlines:
    text = "\n\n" + text + "\n\n";
    
    // Convert all tabs to spaces.
    text = _Detab(text);
    
    // Strip any lines consisting only of spaces and tabs.
    // This makes subsequent regexen easier to write, because we can
    // match consecutive blank lines with /\n+/ instead of something
    // contorted like /[ \t]*\n+/ .
    text = text.replace(/^[ \t]+$/mg, "");
    
    // Run language extensions
    Showdown.forEach(g_lang_extensions, function (x) {
      text = _ExecuteExtension(x, text);
    });
    
    // Handle github codeblocks prior to running HashHTML so that
    // HTML contained within the codeblock gets escaped propertly
    text = _DoGithubCodeBlocks(text);
    
    // Turn block-level HTML blocks into hash entries
    text = _HashHTMLBlocks(text);
    
    // Strip link definitions, store in hashes.
    text = _StripLinkDefinitions(text);
    
    text = _RunBlockGamut(text);
    
    text = _UnescapeSpecialChars(text);
    
    // attacklab: Restore dollar signs
    text = text.replace(/~D/g, "$$");
    
    // attacklab: Restore tildes
    text = text.replace(/~T/g, "~");
    
    // Run output modifiers
    Showdown.forEach(g_output_modifiers, function (x) {
      text = _ExecuteExtension(x, text);
    });
    
    return text;
  };
  
  
  //
  // Options:
  //
  
  // Parse extensions options into separate arrays
  if (converter_options && converter_options.extensions) {
    
    var self = this;
    
    // Iterate over each plugin
    Showdown.forEach(converter_options.extensions, function (plugin) {
      
      // Assume it's a bundled plugin if a string is given
      if (typeof plugin === 'string') {
        plugin = Showdown.extensions[stdExtName(plugin)];
      }
      
      if (typeof plugin === 'function') {
        // Iterate over each extension within that plugin
        Showdown.forEach(plugin(self), function (ext) {
          // Sort extensions by type
          if (ext.type) {
            if (ext.type === 'language' || ext.type === 'lang') {
              g_lang_extensions.push(ext);
            } else if (ext.type === 'output' || ext.type === 'html') {
              g_output_modifiers.push(ext);
            }
          } else {
            // Assume language extension
            g_output_modifiers.push(ext);
          }
        });
      } else {
        throw "Extension '" + plugin + "' could not be loaded.  It was either not found or is not a valid extension.";
      }
    });
  }
  
  
  var _ExecuteExtension = function (ext, text) {
    if (ext.regex) {
      var re = new RegExp(ext.regex, 'g');
      return text.replace(re, ext.replace);
    } else if (ext.filter) {
      return ext.filter(text);
    }
  };
  
  var _StripLinkDefinitions = function (text) {
    //
    // Strips link definitions from text, stores the URLs and titles in
    // hash references.
    //
    
    // Link defs are in the form: ^[id]: url "optional title"
    
    /*
    var text = text.replace(/
    ^[ ]{0,3}\[(.+)\]:  // id = $1  attacklab: g_tab_width - 1
    [ \t]*
    \n?        // maybe *one* newline
    [ \t]*
    <?(\S+?)>?      // url = $2
    [ \t]*
    \n?        // maybe one newline
    [ \t]*
    (?:
    (\n*)        // any lines skipped = $3 attacklab: lookbehind removed
    ["(]
    (.+?)        // title = $4
    [")]
    [ \t]*
    )?          // title is optional
    (?:\n+|$)
    /gm,
    function(){...});
    */
    
    // attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
    text += "~0";
    
    text = text.replace(/^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|(?=~0))/gm,
                        function (wholeMatch, m1, m2, m3, m4) {
                          m1 = m1.toLowerCase();
                          g_urls[m1] = _EncodeAmpsAndAngles(m2);  // Link IDs are case-insensitive
                          if (m3) {
                            // Oops, found blank lines, so it's not a title.
                            // Put back the parenthetical statement we stole.
                            return m3 + m4;
                          } else if (m4) {
                            g_titles[m1] = m4.replace(/"/g, "&quot;");
                          }
                          
                          // Completely remove the definition from the text
                          return "";
                        }
                       );
    
    // attacklab: strip sentinel
    text = text.replace(/~0/, "");
    
    return text;
  }
  
  var _HashHTMLBlocks = function (text) {
    // attacklab: Double up blank lines to reduce lookaround
    text = text.replace(/\n/g, "\n\n");
    
    // Hashify HTML blocks:
    // We only want to do this for block-level HTML tags, such as headers,
    // lists, and tables. That's because we still want to wrap <p>s around
    // "paragraphs" that are wrapped in non-block-level tags, such as anchors,
    // phrase emphasis, and spans. The list of tags we're looking for is
    // hard-coded:
    var block_tags_a = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del|style|section|header|footer|nav|article|aside";
    var block_tags_b = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|style|section|header|footer|nav|article|aside";
    
    // First, look for nested blocks, e.g.:
    //   <div>
    //     <div>
    //     tags for inner block must be indented.
    //     </div>
    //   </div>
    //
    // The outermost tags must start at the left margin for this to match, and
    // the inner nested divs must be indented.
    // We need to do this before the next, more liberal match, because the next
    // match will start at the first `<div>` and stop at the first `</div>`.
    
    // attacklab: This regex can be expensive when it fails.
    /*
    var text = text.replace(/
    (            // save in $1
    ^          // start of line  (with /m)
    <($block_tags_a)  // start tag = $2
    \b          // word break
    // attacklab: hack around khtml/pcre bug...
    [^\r]*?\n      // any number of lines, minimally matching
    </\2>        // the matching end tag
    [ \t]*        // trailing spaces/tabs
    (?=\n+)        // followed by a newline
    )            // attacklab: there are sentinel newlines at end of document
    /gm,function(){...}};
    */
    text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm, hashElement);
    
    //
    // Now match more liberally, simply from `\n<tag>` to `</tag>\n`
    //
    
    /*
    var text = text.replace(/
    (            // save in $1
    ^          // start of line  (with /m)
    <($block_tags_b)  // start tag = $2
    \b          // word break
    // attacklab: hack around khtml/pcre bug...
    [^\r]*?        // any number of lines, minimally matching
    </\2>        // the matching end tag
    [ \t]*        // trailing spaces/tabs
    (?=\n+)        // followed by a newline
    )            // attacklab: there are sentinel newlines at end of document
    /gm,function(){...}};
    */
    text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|style|section|header|footer|nav|article|aside)\b[^\r]*?<\/\2>[ \t]*(?=\n+)\n)/gm, hashElement);
    
    // Special case just for <hr />. It was easier to make a special case than
    // to make the other regex more complicated.
    
    /*
    text = text.replace(/
    (            // save in $1
    \n\n        // Starting after a blank line
    [ ]{0,3}
    (<(hr)        // start tag = $2
    \b          // word break
    ([^<>])*?      //
    \/?>)        // the matching end tag
    [ \t]*
    (?=\n{2,})      // followed by a blank line
    )
    /g,hashElement);
    */
    text = text.replace(/(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g, hashElement);
    
    // Special case for standalone HTML comments:
    
    /*
    text = text.replace(/
    (            // save in $1
    \n\n        // Starting after a blank line
    [ ]{0,3}      // attacklab: g_tab_width - 1
    <!
    (--[^\r]*?--\s*)+
    >
    [ \t]*
    (?=\n{2,})      // followed by a blank line
    )
    /g,hashElement);
    */
    text = text.replace(/(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g, hashElement);
    
    // PHP and ASP-style processor instructions (<?...?> and <%...%>)
    
    /*
    text = text.replace(/
    (?:
    \n\n        // Starting after a blank line
    )
    (            // save in $1
    [ ]{0,3}      // attacklab: g_tab_width - 1
    (?:
    <([?%])      // $2
    [^\r]*?
    \2>
    )
    [ \t]*
    (?=\n{2,})      // followed by a blank line
    )
    /g,hashElement);
    */
    text = text.replace(/(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g, hashElement);
    
    // attacklab: Undo double lines (see comment at top of this function)
    text = text.replace(/\n\n/g, "\n");
    return text;
  }
  
  var hashElement = function (wholeMatch, m1) {
    var blockText = m1;
    
    // Undo double lines
    blockText = blockText.replace(/\n\n/g, "\n");
    blockText = blockText.replace(/^\n/, "");
    
    // strip trailing blank lines
    blockText = blockText.replace(/\n+$/g, "");
    
    // Replace the element text with a marker ("~KxK" where x is its key)
    blockText = "\n\n~K" + (g_html_blocks.push(blockText) - 1) + "K\n\n";
    
    return blockText;
  };
  
  var _RunBlockGamut = function (text) {
    //
    // These are all the transformations that form block-level
    // tags like paragraphs, headers, and list items.
    //
    text = _DoHeaders(text);
    
    // Do Horizontal Rules:
    var key = hashBlock("<hr />");
    text = text.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm, key);
    text = text.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm, key);
    text = text.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm, key);
    
    text = _DoLists(text);
    text = _DoCodeBlocks(text);
    text = _DoBlockQuotes(text);
    
    // We already ran _HashHTMLBlocks() before, in Markdown(), but that
    // was to escape raw HTML in the original Markdown source. This time,
    // we're escaping the markup we've just created, so that we don't wrap
    // <p> tags around block-level tags.
    text = _HashHTMLBlocks(text);
    text = _FormParagraphs(text);
    
    return text;
  };
  
  var _RunSpanGamut = function (text) {
    //
    // These are all the transformations that occur *within* block-level
    // tags like paragraphs, headers, and list items.
    //
    
    text = _DoCodeSpans(text);
    text = _EscapeSpecialCharsWithinTagAttributes(text);
    text = _EncodeBackslashEscapes(text);
    
    // Process anchor and image tags. Images must come first,
    // because ![foo][f] looks like an anchor.
    text = _DoImages(text);
    text = _DoAnchors(text);
    
    // Make links out of things like `<http://example.com/>`
    // Must come after _DoAnchors(), because you can use < and >
    // delimiters in inline links like [this](<url>).
    text = _DoAutoLinks(text);
    text = _EncodeAmpsAndAngles(text);
    text = _DoItalicsAndBold(text);
    
    // Do hard breaks:
    text = text.replace(/  +\n/g, " <br />\n");
    
    return text;
  }
  
  var _EscapeSpecialCharsWithinTagAttributes = function (text) {
    //
    // Within tags -- meaning between < and > -- encode [\ ` * _] so they
    // don't conflict with their use in Markdown for code, italics and strong.
    //
    
    // Build a regex to find HTML tags and comments.  See Friedl's
    // "Mastering Regular Expressions", 2nd Ed., pp. 200-201.
    var regex = /(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;
    
    text = text.replace(regex, function (wholeMatch) {
      var tag = wholeMatch.replace(/(.)<\/?code>(?=.)/g, "$1`");
      tag = escapeCharacters(tag, "\\`*_");
      return tag;
    });
    
    return text;
  }
  
  var _DoAnchors = function (text) {
    //
    // Turn Markdown link shortcuts into XHTML <a> tags.
    //
    //
    // First, handle reference-style links: [link text] [id]
    //
    
    /*
    text = text.replace(/
    (              // wrap whole match in $1
    \[
    (
    (?:
    \[[^\]]*\]    // allow brackets nested one level
    |
    [^\[]      // or anything else
    )*
    )
    \]
    [ ]?          // one optional space
    (?:\n[ ]*)?        // one optional newline followed by spaces
    \[
    (.*?)          // id = $3
    \]
    )()()()()          // pad remaining backreferences
    /g,_DoAnchors_callback);
    */
    text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g, writeAnchorTag);
    
    //
    // Next, inline-style links: [link text](url "optional title")
    //
    
    /*
    text = text.replace(/
    (            // wrap whole match in $1
    \[
    (
    (?:
    \[[^\]]*\]  // allow brackets nested one level
    |
    [^\[\]]      // or anything else
    )
    )
    \]
    \(            // literal paren
    [ \t]*
    ()            // no id, so leave $3 empty
    <?(.*?)>?        // href = $4
    [ \t]*
    (            // $5
    (['"])        // quote char = $6
    (.*?)        // Title = $7
    \6          // matching quote
    [ \t]*        // ignore any spaces/tabs between closing quote and )
    )?            // title is optional
    \)
    )
    /g,writeAnchorTag);
    */
    text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?(?:\(.*?\).*?)?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g, writeAnchorTag);
    
    //
    // Last, handle reference-style shortcuts: [link text]
    // These must come last in case you've also got [link test][1]
    // or [link test](/foo)
    //
    
    /*
    text = text.replace(/
    (               // wrap whole match in $1
    \[
    ([^\[\]]+)        // link text = $2; can't contain '[' or ']'
    \]
    )()()()()()          // pad rest of backreferences
    /g, writeAnchorTag);
    */
    text = text.replace(/(\[([^\[\]]+)\])()()()()()/g, writeAnchorTag);
    
    return text;
  }
  
  var writeAnchorTag = function (wholeMatch, m1, m2, m3, m4, m5, m6, m7) {
    if (m7 == undefined) m7 = "";
    var whole_match = m1;
    var link_text = m2;
    var link_id = m3.toLowerCase();
    var url = m4;
    var title = m7;
    
    if (url == "") {
      if (link_id == "") {
        // lower-case and turn embedded newlines into spaces
        link_id = link_text.toLowerCase().replace(/ ?\n/g, " ");
      }
      url = "#" + link_id;
      
      if (g_urls[link_id] != undefined) {
        url = g_urls[link_id];
        if (g_titles[link_id] != undefined) {
          title = g_titles[link_id];
        }
      }
      else {
        if (whole_match.search(/\(\s*\)$/m) > -1) {
          // Special case for explicit empty url
          url = "";
        } else {
          return whole_match;
        }
      }
    }
    
    url = escapeCharacters(url, "*_");
    var result = "<a href=\"" + url + "\"";
    
    if (title != "") {
      title = title.replace(/"/g, "&quot;");
      title = escapeCharacters(title, "*_");
      result += " title=\"" + title + "\"";
    }
    
    result += ">" + link_text + "</a>";
    
    return result;
  }
  
  var _DoImages = function (text) {
    //
    // Turn Markdown image shortcuts into <img> tags.
    //
    
    //
    // First, handle reference-style labeled images: ![alt text][id]
    //
    
    /*
    text = text.replace(/
    (            // wrap whole match in $1
    !\[
    (.*?)        // alt text = $2
    \]
    [ ]?        // one optional space
    (?:\n[ ]*)?      // one optional newline followed by spaces
    \[
    (.*?)        // id = $3
    \]
    )()()()()        // pad rest of backreferences
    /g,writeImageTag);
    */
    text = text.replace(/(!\[(.*?)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g, writeImageTag);
    
    //
    // Next, handle inline images:  ![alt text](url "optional title")
    // Don't forget: encode * and _
    
    /*
    text = text.replace(/
    (            // wrap whole match in $1
    !\[
    (.*?)        // alt text = $2
    \]
    \s?          // One optional whitespace character
    \(          // literal paren
    [ \t]*
    ()          // no id, so leave $3 empty
    <?(\S+?)>?      // src url = $4
    [ \t]*
    (          // $5
    (['"])      // quote char = $6
    (.*?)      // title = $7
    \6        // matching quote
    [ \t]*
    )?          // title is optional
    \)
    )
    /g,writeImageTag);
    */
    text = text.replace(/(!\[(.*?)\]\s?\([ \t]*()<?(\S+?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g, writeImageTag);
    
    return text;
  }
  
  var writeImageTag = function (wholeMatch, m1, m2, m3, m4, m5, m6, m7) {
    var whole_match = m1;
    var alt_text = m2;
    var link_id = m3.toLowerCase();
    var url = m4;
    var title = m7;
    
    if (!title) title = "";
    
    if (url == "") {
      if (link_id == "") {
        // lower-case and turn embedded newlines into spaces
        link_id = alt_text.toLowerCase().replace(/ ?\n/g, " ");
      }
      url = "#" + link_id;
      
      if (g_urls[link_id] != undefined) {
        url = g_urls[link_id];
        if (g_titles[link_id] != undefined) {
          title = g_titles[link_id];
        }
      }
      else {
        return whole_match;
      }
    }
    
    alt_text = alt_text.replace(/"/g, "&quot;");
    url = escapeCharacters(url, "*_");
    var result = "<img src=\"" + url + "\" alt=\"" + alt_text + "\"";
    
    // attacklab: Markdown.pl adds empty title attributes to images.
    // Replicate this bug.
    
    //if (title != "") {
    title = title.replace(/"/g, "&quot;");
    title = escapeCharacters(title, "*_");
    result += " title=\"" + title + "\"";
    //}
    
    result += " />";
    
    return result;
  }
  
  var _DoHeaders = function (text) {
    
    // Setext-style headers:
    //  Header 1
    //  ========
    //
    //  Header 2
    //  --------
    //
    text = text.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm,
                        function (wholeMatch, m1) {
                          return hashBlock('<h1 id="' + headerId(m1) + '">' + _RunSpanGamut(m1) + "</h1>");
                        });
    
    text = text.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm,
                        function (matchFound, m1) {
                          return hashBlock('<h2 id="' + headerId(m1) + '">' + _RunSpanGamut(m1) + "</h2>");
                        });
    
    // atx-style headers:
    //  # Header 1
    //  ## Header 2
    //  ## Header 2 with closing hashes ##
    //  ...
    //  ###### Header 6
    //
    
    /*
    text = text.replace(/
    ^(\#{1,6})        // $1 = string of #'s
    [ \t]*
    (.+?)          // $2 = Header text
    [ \t]*
    \#*            // optional closing #'s (not counted)
    \n+
    /gm, function() {...});
    */
    
    text = text.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm,
                        function (wholeMatch, m1, m2) {
                          var h_level = m1.length;
                          return hashBlock("<h" + h_level + ' id="' + headerId(m2) + '">' + _RunSpanGamut(m2) + "</h" + h_level + ">");
                        });
    
    function headerId(m) {
      return m.replace(/[^\w]/g, '').toLowerCase();
    }
    
    return text;
  }
  
  // This declaration keeps Dojo compressor from outputting garbage:
  var _ProcessListItems;
  
  var _DoLists = function (text) {
    //
    // Form HTML ordered (numbered) and unordered (bulleted) lists.
    //
    
    // attacklab: add sentinel to hack around khtml/safari bug:
    // http://bugs.webkit.org/show_bug.cgi?id=11231
    text += "~0";
    
    // Re-usable pattern to match any entirel ul or ol list:
    
    /*
    var whole_list = /
    (                  // $1 = whole list
    (                // $2
    [ ]{0,3}          // attacklab: g_tab_width - 1
    ([*+-]|\d+[.])        // $3 = first list item marker
    [ \t]+
    )
    [^\r]+?
    (                // $4
    ~0              // sentinel for workaround; should be $
    |
    \n{2,}
    (?=\S)
    (?!              // Negative lookahead for another list item marker
    [ \t]*
    (?:[*+-]|\d+[.])[ \t]+
    )
    )
    )/g
    */
    var whole_list = /^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm;
    
    if (g_list_level) {
      text = text.replace(whole_list, function (wholeMatch, m1, m2) {
        var list = m1;
        var list_type = (m2.search(/[*+-]/g) > -1) ? "ul" : "ol";
        
        // Turn double returns into triple returns, so that we can make a
        // paragraph for the last item in a list, if necessary:
        list = list.replace(/\n{2,}/g, "\n\n\n");
        ;
        var result = _ProcessListItems(list);
        
        // Trim any trailing whitespace, to put the closing `</$list_type>`
        // up on the preceding line, to get it past the current stupid
        // HTML block parser. This is a hack to work around the terrible
        // hack that is the HTML block parser.
        result = result.replace(/\s+$/, "");
        result = "<" + list_type + ">" + result + "</" + list_type + ">\n";
        return result;
      });
    } else {
      whole_list = /(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g;
      text = text.replace(whole_list, function (wholeMatch, m1, m2, m3) {
        var runup = m1;
        var list = m2;
        
        var list_type = (m3.search(/[*+-]/g) > -1) ? "ul" : "ol";
        // Turn double returns into triple returns, so that we can make a
        // paragraph for the last item in a list, if necessary:
        var list = list.replace(/\n{2,}/g, "\n\n\n");
        ;
        var result = _ProcessListItems(list);
        result = runup + "<" + list_type + ">\n" + result + "</" + list_type + ">\n";
        return result;
      });
    }
    
    // attacklab: strip sentinel
    text = text.replace(/~0/, "");
    
    return text;
  }
  
  _ProcessListItems = function (list_str) {
    //
    //  Process the contents of a single ordered or unordered list, splitting it
    //  into individual list items.
    //
    // The $g_list_level global keeps track of when we're inside a list.
    // Each time we enter a list, we increment it; when we leave a list,
    // we decrement. If it's zero, we're not in a list anymore.
    //
    // We do this because when we're not inside a list, we want to treat
    // something like this:
    //
    //    I recommend upgrading to version
    //    8. Oops, now this line is treated
    //    as a sub-list.
    //
    // As a single paragraph, despite the fact that the second line starts
    // with a digit-period-space sequence.
    //
    // Whereas when we're inside a list (or sub-list), that line will be
    // treated as the start of a sub-list. What a kludge, huh? This is
    // an aspect of Markdown's syntax that's hard to parse perfectly
    // without resorting to mind-reading. Perhaps the solution is to
    // change the syntax rules such that sub-lists must start with a
    // starting cardinal number; e.g. "1." or "a.".
    
    g_list_level++;
    
    // trim trailing blank lines:
    list_str = list_str.replace(/\n{2,}$/, "\n");
    
    // attacklab: add sentinel to emulate \z
    list_str += "~0";
    
    /*
    list_str = list_str.replace(/
    (\n)?              // leading line = $1
    (^[ \t]*)            // leading whitespace = $2
    ([*+-]|\d+[.]) [ \t]+      // list marker = $3
    ([^\r]+?            // list item text   = $4
    (\n{1,2}))
    (?= \n* (~0 | \2 ([*+-]|\d+[.]) [ \t]+))
    /gm, function(){...});
    */
    list_str = list_str.replace(/(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm,
                                function (wholeMatch, m1, m2, m3, m4) {
                                  var item = m4;
                                  var leading_line = m1;
                                  var leading_space = m2;
                                  
                                  if (leading_line || (item.search(/\n{2,}/) > -1)) {
                                    item = _RunBlockGamut(_Outdent(item));
                                  }
                                  else {
                                    // Recursion for sub-lists:
                                    item = _DoLists(_Outdent(item));
                                    item = item.replace(/\n$/, ""); // chomp(item)
                                    item = _RunSpanGamut(item);
                                  }
                                  
                                  return "<li>" + item + "</li>\n";
                                }
                               );
    
    // attacklab: strip sentinel
    list_str = list_str.replace(/~0/g, "");
    
    g_list_level--;
    return list_str;
  }
  
  var _DoCodeBlocks = function (text) {
    //
    //  Process Markdown `<pre><code>` blocks.
    //
    
    /*
    text = text.replace(text,
    /(?:\n\n|^)
    (                // $1 = the code block -- one or more lines, starting with a space/tab
    (?:
    (?:[ ]{4}|\t)      // Lines must start with a tab or a tab-width of spaces - attacklab: g_tab_width
    .*\n+
    )+
    )
    (\n*[ ]{0,3}[^ \t\n]|(?=~0))  // attacklab: g_tab_width
    /g,function(){...});
    */
    
    // attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
    text += "~0";
    
    text = text.replace(/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g,
                        function (wholeMatch, m1, m2) {
                          var codeblock = m1;
                          var nextChar = m2;
                          
                          codeblock = _EncodeCode(_Outdent(codeblock));
                          codeblock = _Detab(codeblock);
                          codeblock = codeblock.replace(/^\n+/g, ""); // trim leading newlines
                          codeblock = codeblock.replace(/\n+$/g, ""); // trim trailing whitespace
                          
                          codeblock = '<pre><code ' + (getConstants())['codeBlockStyle'] + '>' + codeblock + "\n</code></pre>";
                          
                          return hashBlock(codeblock) + nextChar;
                        }
                       );
    
    // attacklab: strip sentinel
    text = text.replace(/~0/, "");
    
    return text;
  };
  
  var _DoGithubCodeBlocks = function (text) {
    //
    //  Process Github-style code blocks
    //  Example:
    //  ```ruby
    //  def hello_world(x)
    //    puts "Hello, #{x}"
    //  end
    //  ```
    //
    
    
    // attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
    text += "~0";
    
    text = text.replace(/(?:^|\n)```(.*)\n([\s\S]*?)\n```/g,
                        function (wholeMatch, m1, m2) {
                          var language = m1;
                          var codeblock = m2;
                          
                          codeblock = _EncodeCode(codeblock);
                          codeblock = _Detab(codeblock);
                          codeblock = codeblock.replace(/^\n+/g, ""); // trim leading newlines
                          codeblock = codeblock.replace(/\n+$/g, ""); // trim trailing whitespace
                          
                          codeblock = "<pre><code " + (getConstants())['codeBlockStyle'] + ' ' + (language ? " class=\"" + language + '"' : "") + ">" + codeblock + "\n</code></pre>";
                          
                          return hashBlock(codeblock);
                        }
                       );
    
    // attacklab: strip sentinel
    text = text.replace(/~0/, "");
    
    return text;
  }
  
  var hashBlock = function (text) {
    text = text.replace(/(^\n+|\n+$)/g, "");
    return "\n\n~K" + (g_html_blocks.push(text) - 1) + "K\n\n";
  }
  
  var _DoCodeSpans = function (text) {
    //
    //   *  Backtick quotes are used for <code></code> spans.
    //
    //   *  You can use multiple backticks as the delimiters if you want to
    //   include literal backticks in the code span. So, this input:
    //
    //     Just type ``foo `bar` baz`` at the prompt.
    //
    //     Will translate to:
    //
    //     <p>Just type <code>foo `bar` baz</code> at the prompt.</p>
    //
    //  There's no arbitrary limit to the number of backticks you
    //  can use as delimters. If you need three consecutive backticks
    //  in your code, use four for delimiters, etc.
    //
    //  *  You can use spaces to get literal backticks at the edges:
    //
    //     ... type `` `bar` `` ...
    //
    //     Turns to:
    //
    //     ... type <code>`bar`</code> ...
    //
    
    /*
    text = text.replace(/
    (^|[^\\])          // Character before opening ` can't be a backslash
    (`+)            // $2 = Opening run of `
    (              // $3 = The code block
    [^\r]*?
    [^`]          // attacklab: work around lack of lookbehind
    )
    \2              // Matching closer
    (?!`)
    /gm, function(){...});
    */
    
    text = text.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
                        function (wholeMatch, m1, m2, m3, m4) {
                          //var constants = getConstants();
                          //var codeBlockStyle = constants['codeBlockStyle'];
                          //logVerbose('codeBlockStyle');
                          //logVerbose(codeBlockStyle);
                          var c = m3;
                          c = c.replace(/^([ \t]*)/g, "");  // leading whitespace
                          c = c.replace(/[ \t]*$/g, "");  // trailing whitespace
                          c = _EncodeCode(c);
                          return m1 + '<code ' + (getConstants())['codeSpanStyle'] + '>' + c + "</code>";
                        });
    
    return text;
  }
  
  var _EncodeCode = function (text) {
    //
    // Encode/escape certain characters inside Markdown code runs.
    // The point is that in code, these characters are literals,
    // and lose their special Markdown meanings.
    //
    // Encode all ampersands; HTML entities are not
    // entities within a Markdown code span.
    text = text.replace(/&/g, "&amp;");
    
    // Do the angle bracket song and dance:
    text = text.replace(/</g, "&lt;");
    text = text.replace(/>/g, "&gt;");
    
    // Now, escape characters that are magic in Markdown:
    text = escapeCharacters(text, "\*_{}[]\\", false);
    
    // jj the line above breaks this:
    //---
    
    //* Item
    
    //   1. Subitem
    
    //            special char: *
    //---
    
    return text;
  }
  
  var _DoItalicsAndBold = function (text) {
    var constants = getConstants();
    
    // <strong> must go first:
    text = text.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g, "<strong " + constants['strongStyle'] + ">$2</strong>");
    
    text = text.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g, "<em " + constants['emStyle'] + ">$2</em>");
    
    return text;
  }
  
  var _DoBlockQuotes = function (text) {
    
    /*
    text = text.replace(/
    (                   // Wrap whole match in $1
    (
    ^[ \t]*>[ \t]?      // '>' at the start of a line
    .+\n                // rest of the first line
    (.+\n)*             // subsequent consecutive lines
    \n*                 // blanks
    )+
    )
    /gm, function(){...});
    */
    
    text = text.replace(/((^[ \t]*>[ \t]?.+\n(.+\n)*\n*)+)/gm,
                        function (wholeMatch, m1) {
                          var bq = m1;
                          
                          // attacklab: hack around Konqueror 3.5.4 bug:
                          // "----------bug".replace(/^-/g,"") == "bug"
                          
                          bq = bq.replace(/^[ \t]*>[ \t]?/gm, "~0");  // trim one level of quoting
                          
                          // attacklab: clean up hack
                          bq = bq.replace(/~0/g, "");
                          
                          bq = bq.replace(/^[ \t]+$/gm, "");    // trim whitespace-only lines
                          bq = _RunBlockGamut(bq);        // recurse
                          
                          bq = bq.replace(/(^|\n)/g, "$1  ");
                          // These leading spaces screw with <pre> content, so we need to fix that:
                          bq = bq.replace(
                            /(\s*<pre>[^\r]+?<\/pre>)/gm,
                            function (wholeMatch, m1) {
                              var pre = m1;
                              // attacklab: hack around Konqueror 3.5.4 bug:
                              pre = pre.replace(/^  /mg, "~0");
                              pre = pre.replace(/~0/g, "");
                              return pre;
                            });
                          
                          return hashBlock("<blockquote>\n" + bq + "\n</blockquote>");
                        });
    return text;
  }
  
  var _FormParagraphs = function (text) {
    //
    //  Params:
    //    $text - string to process with html <p> tags
    //
    
    // Strip leading and trailing lines:
    text = text.replace(/^\n+/g, "");
    text = text.replace(/\n+$/g, "");
    
    var grafs = text.split(/\n{2,}/g);
    var grafsOut = [];
    
    //
    // Wrap <p> tags.
    //
    var end = grafs.length;
    for (var i = 0; i < end; i++) {
      var str = grafs[i];
      
      // if this is an HTML marker, copy it
      if (str.search(/~K(\d+)K/g) >= 0) {
        grafsOut.push(str);
      }
      else if (str.search(/\S/) >= 0) {
        str = _RunSpanGamut(str);
        str = str.replace(/^([ \t]*)/g, "<p>");
        str += "</p>"
        grafsOut.push(str);
      }
      
    }
    
    //
    // Unhashify HTML blocks
    //
    end = grafsOut.length;
    for (var i = 0; i < end; i++) {
      // if this is a marker for an html block...
      while (grafsOut[i].search(/~K(\d+)K/) >= 0) {
        var blockText = g_html_blocks[RegExp.$1];
        blockText = blockText.replace(/\$/g, "$$$$"); // Escape any dollar signs
        grafsOut[i] = grafsOut[i].replace(/~K\d+K/, blockText);
      }
    }
    
    return grafsOut.join("\n\n");
  }
  
  var _EncodeAmpsAndAngles = function (text) {
    // Smart processing for ampersands and angle brackets that need to be encoded.
    
    // Ampersand-encoding based entirely on Nat Irons's Amputator MT plugin:
    //   http://bumppo.net/projects/amputator/
    text = text.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g, "&amp;");
    
    // Encode naked <'s
    text = text.replace(/<(?![a-z\/?\$!])/gi, "&lt;");
    
    return text;
  }
  
  var _EncodeBackslashEscapes = function (text) {
    //
    //   Parameter: String.
    //   Returns:   The string, with after processing the following backslash
    //              escape sequences.
    //
    
    // attacklab: The polite way to do this is with the new
    // escapeCharacters() function:
    //
    //   text = escapeCharacters(text,"\\",true);
    //   text = escapeCharacters(text,"`*_{}[]()>#+-.!",true);
    //
    // ...but we're sidestepping its use of the (slow) RegExp constructor
    // as an optimization for Firefox.  This function gets called a LOT.
    
    text = text.replace(/\\(\\)/g, escapeCharacters_callback);
    text = text.replace(/\\([`*_{}\[\]()>#+-.!])/g, escapeCharacters_callback);
    return text;
  }
  
  var _DoAutoLinks = function (text) {
    
    text = text.replace(/<((https?|ftp|dict):[^'">\s]+)>/gi, "<a href=\"$1\">$1</a>");
    
    // Email addresses: <address@domain.foo>
    
    /*
    text = text.replace(/
    <
    (?:mailto:)?
    (
    [-.\w]+
    \@
    [-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+
    )
    >
    /gi, _DoAutoLinks_callback());
    */
    text = text.replace(/<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,
                        function (wholeMatch, m1) {
                          return _EncodeEmailAddress(_UnescapeSpecialChars(m1));
                        }
                       );
    
    return text;
  }
  
  var _EncodeEmailAddress = function (addr) {
    //
    //  Input: an email address, e.g. "foo@example.com"
    //
    //  Output: the email address as a mailto link, with each character
    //  of the address encoded as either a decimal or hex entity, in
    //  the hopes of foiling most address harvesting spam bots. E.g.:
    //
    //  <a href="&#x6D;&#97;&#105;&#108;&#x74;&#111;:&#102;&#111;&#111;&#64;&#101;
    //     x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;&#109;">&#102;&#111;&#111;
    //     &#64;&#101;x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;&#109;</a>
    //
    //  Based on a filter by Matthew Wickline, posted to the BBEdit-Talk
    //  mailing list: <http://tinyurl.com/yu7ue>
    //
    
    var encode = [
      function (ch) {
        return "&#" + ch.charCodeAt(0) + ";";
      },
      function (ch) {
        return "&#x" + ch.charCodeAt(0).toString(16) + ";";
      },
      function (ch) {
        return ch;
      }
    ];
    
    addr = "mailto:" + addr;
    
    addr = addr.replace(/./g, function (ch) {
      if (ch == "@") {
        // this *must* be encoded. I insist.
        ch = encode[Math.floor(Math.random() * 2)](ch);
      } else if (ch != ":") {
        // leave ':' alone (to spot mailto: later)
        var r = Math.random();
        // roughly 10% raw, 45% hex, 45% dec
        ch = (
          r > .9 ? encode[2](ch) :
        r > .45 ? encode[1](ch) :
        encode[0](ch)
        );
      }
      return ch;
    });
    
    addr = "<a href=\"" + addr + "\">" + addr + "</a>";
    addr = addr.replace(/">.+:/g, "\">"); // strip the mailto: from the visible part
    
    return addr;
  }
  
  var _UnescapeSpecialChars = function (text) {
    //
    // Swap back in all the special characters we've hidden.
    //
    text = text.replace(/~E(\d+)E/g,
                        function (wholeMatch, m1) {
                          var charCodeToReplace = parseInt(m1);
                          return String.fromCharCode(charCodeToReplace);
                        }
                       );
    return text;
  }
  
  var _Outdent = function (text) {
    //
    // Remove one level of line-leading tabs or spaces
    //
    
    // attacklab: hack around Konqueror 3.5.4 bug:
    // "----------bug".replace(/^-/g,"") == "bug"
    
    text = text.replace(/^(\t|[ ]{1,4})/gm, "~0"); // attacklab: g_tab_width
    
    // attacklab: clean up hack
    text = text.replace(/~0/g, "")
    
    return text;
  }
  
  var _Detab = function (text) {
    // attacklab: Detab's completely rewritten for speed.
    // In perl we could fix it by anchoring the regexp with \G.
    // In javascript we're less fortunate.
    
    // expand first n-1 tabs
    text = text.replace(/\t(?=\t)/g, "    "); // attacklab: g_tab_width
    
    // replace the nth with two sentinels
    text = text.replace(/\t/g, "~A~B");
    
    // use the sentinel to anchor our regex so it doesn't explode
    text = text.replace(/~B(.+?)~A/g,
                        function (wholeMatch, m1, m2) {
                          var leadingText = m1;
                          var numSpaces = 4 - leadingText.length % 4;  // attacklab: g_tab_width
                          
                          // there *must* be a better way to do this:
                          for (var i = 0; i < numSpaces; i++) leadingText += " ";
                          
                          return leadingText;
                        }
                       );
    
    // clean up sentinels
    text = text.replace(/~A/g, "    ");  // attacklab: g_tab_width
    text = text.replace(/~B/g, "");
    
    return text;
  }
  
  
  //
  //  attacklab: Utility functions
  //
  
  
  var escapeCharacters = function (text, charsToEscape, afterBackslash) {
    // First we have to escape the escape characters so that
    // we can build a character class out of them
    var regexString = "([" + charsToEscape.replace(/([\[\]\\])/g, "\\$1") + "])";
    
    if (afterBackslash) {
      regexString = "\\\\" + regexString;
    }
    
    var regex = new RegExp(regexString, "g");
    text = text.replace(regex, escapeCharacters_callback);
    
    return text;
  }
  
  
  var escapeCharacters_callback = function (wholeMatch, m1) {
    var charCodeToEscape = m1.charCodeAt(0);
    return "~E" + charCodeToEscape + "E";
  }
  
  } // end of Showdown.converter


// export
if (typeof module !== 'undefined') module.exports = Showdown;

// stolen from AMD branch of underscore
// AMD define happens at the end for compatibility with AMD loaders
// that don't enforce next-turn semantics on modules.
if (typeof define === 'function' && define.amd) {
  define('showdown', function () {
    return Showdown;
  });
}



// stringUtils.gs
/////////////////

function stringUtilsTest() {
  Logger.log(removeExtFromFilename('hi.hello.txt'));
  Logger.log(removeExtFromFilename('hello.txt'));
  Logger.log(removeExtFromFilename('hello'));
  Logger.log(removeExtFromFilename(''));
  logVerbose('hello, moose!');
  
  var fileTitle = 'moose.jpg';
  logVerbose(convertTitleToUrlSafe(fileTitle));
  
  
}

function extFromFilename(filename) {
  var a = filename.split('.');
  if( a.length === 1 || ( a[0] === '' && a.length === 2 ) ) {
    return '';
  }
  return a.pop().toLowerCase();
}

function removeExtFromFilename(filename) {
  return filename.substr(0, filename.lastIndexOf('.')) || filename;
}

function logVerbose(str) {
  //var scriptProperties = PropertiesService.getScriptProperties();
  //var verbose = scriptProperties.getProperty('verbose');
  var constants = getConstants();
  var verbose = constants['verbose'];
  if (verbose === 'true') {
    Logger.log(str);
  }
  return verbose;
}

function convertTitleToUrlSafe(fileTitle) {
  var fileTitleLower = fileTitle.toLowerCase();
  var fileTitleLowerSpaced = fileTitleLower.replace(/-/g, ' ');  // Turns '2015-02-21' into '2015 02 21' so it gets dashed later
  var fileTitleLowerStripped = fileTitleLowerSpaced.replace(/[^\w\s]|_/g, "")
  var fileTitleLowerStrippedDashed = fileTitleLowerStripped.replace(/\s+/g, "-");
  return fileTitleLowerStrippedDashed;
}

function stripFancyQuotes(str) {
  var strNoFancyQuotes = str.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  return strNoFancyQuotes;
}



// testPage.gs
//////////////

function testParentExists(site, breadcrumb) {
  // Does the whole breadcrumb path exist?
  var parent = getParentFromBreadcrumb(site, breadcrumb, null);
  if (!parent) {
    return false;
  } else {
    return true;
  }
}

function testPageExists(site, pageName, breadcrumb, parent) {
  if (!parent) {
    // We weren't given a parent; go find one
    parent = getParentFromBreadcrumb(site, breadcrumb.slice(), parent);
    if (!parent) {
      // We weren't able to find a parent; the child page can't exist (because the parent hasn't been born yet)
      var pageExists = false;
      return pageExists;
    } else {
      // There is a parent; see if child exists
      page = parent.getChildByName(pageName);
      if (!page) {
        // Child doesn't exist; return false
        return false;
      } else {
        // Child exists; return true
        return true;
      }
    }
  }
}


function testPageExists2(site, pageName) {
  var page = site.getChildByName(pageName);
  if (page === null) {
    return false;
  } else {
    return true;
  }
}



// writeSite.gs
///////////////

function syncPages(site, siteHash, driveHash) {
  // Goes through the whole site and adds missing content
  
  var maxPathDepth = getMaxPathDepth(driveHash);
  var constants = getConstants();
  
  Logger.log('');
  Logger.log('We found that the maxPathDepth is ' + maxPathDepth);
  Logger.log('');
  
  // Delete pages that exist in the Site but not in the Drive
  // 
  // Note: this section happens first to avoid the possibility of ever creating
  //   a page later in the create page section that later gets it's parent deleted.
  //   That shouldn't be possible either way, but I think this order makes more sense.
  // 
  for (var i = maxPathDepth; i >= 0; i--) {  // Start deleting from the deepest level
    var pathDepth = 0;
    for (var path in siteHash) {
      pathDepth = getPathDepth(path);
      if (pathDepth === i) {
        // We are looking at paths at the right level (nearest infinity remaining) now
        if (!driveHash.hasOwnProperty(path)) {
          // Path is in Site but not in Drive; delete page from site
          Logger.log('Found ' + path + ' in siteHash but not in driveHash; deleting...');
          removePageFromPath(site, path);
          Logger.log('Deleted ' + path + '!');
        }
      }
    }
  }
  
  // Delete attachments that are on Site pages but not in the Drive
  // 
  // Note: there is no need to go in any "direction" of page depths because
  //   the whole site tree exists at this point
  // Also note: this section is after the "delete pages" section because
  //   pages that get deleted also delete their attachments automatically
  //   and because if (1) we went to delete missing attachments first and
  //   (2) we want to check for page last updated date/time (so we don't have
  //   to check every page, just those that have been updated more recently
  //   in the drive than on the site), we wouldn't have a drive file with
  //   which to compare the timestamp (because the triggering event for the
  //   deletion of a page is the fact that the corresponding file is missing 
  //   in the drive).
  
  logVerbose('Hello, moose.');
  
  for (var path in siteHash) {
    // No need to consider depth since blobs are never the parents of blobs
    if (driveHash.hasOwnProperty(path)) {
      // Don't try to check all the pages because some of them might have been deleted in the previous phase
      if (driveHash[path]['fileLastUpdated'] > siteHash[path]['pageLastUpdated']) {
        // File has been recently updated in drive; check to see if attachments have been removed (we need to delete them)
        
        var page = getPageFromPath(site, path);
        var attachments = page.getAttachments();
        
        for (var attachmentNo in attachments) {
          var attachment = attachments[attachmentNo];
          var attachmentTitle = attachment.getTitle();
          var attachmentExt = extFromFilename(attachmentTitle);
          var attachmentName = convertTitleToUrlSafe(removeExtFromFilename(attachmentTitle)) + '.' + attachmentExt;  // We add the extension back in on purpose
          var attachmentPath = path + '-blobs/' + attachmentName;  // Calculate what the path of the attachment would be if it were inside the drive
          logVerbose('About to check whether ' + attachmentPath + ' is in driveHash...');
          if (!driveHash.hasOwnProperty(attachmentPath)) {
            // Attachment is on page but missing in drive; delete it from the page
            logVerbose('Found ' + attachmentPath + ' in Site but not in Drive. Deleting...');
            attachment.deleteAttachment();
            logVerbose('Deleted ' + attachmentPath + ' from Site!');
          }
        }
      }
    }
  }
  
  
  // Create pages that exist in the Drive but not in the Site
  for (var i = 0; i <= maxPathDepth ; i++) {  // Start creating from the highest level
    var pathDepth = 0;
    for (var path in driveHash) {
      pathDepth = getPathDepth(path);
      if (pathDepth === i) {
        // We are looking at paths at the right level (nearest 0 remaining) now
        if ((!siteHash[path] || driveHash[path]['fileLastUpdated'] > siteHash[path]['pageLastUpdated'] || Math.random() < constants['rebuildChance']) && !driveHash[path]['fileIsBlob']) {
          //Page does not exist yet or is older tha drive or % random chance of updating; update page
          try {
            logVerbose('Found ' + path + ' in driveHash; adding or updating...');
            logVerbose('siteHash[path]:' + siteHash[path]);
            logVerbose("driveHash[path]['fileLastUpdated']:" + driveHash[path]['fileLastUpdated']);
            logVerbose("siteHash[path]['pageLastUpdated']:" + siteHash[path]['pageLastUpdated']);
            logVerbose( driveHash[path]['fileLastUpdated'] > siteHash[path]['pageLastUpdated']);
          } catch(e) {
            // pageLastUpdated may not actually exist because this may be a new page.
          }
          createPageClobber(site, path, siteHash, driveHash);
          Logger.log('CreatedOrUpdated ' + path + '!');
        }
      }
    }
  }
  
  // Create attachments that are in the Drive but not on Site pages
  // Note: there is no need to go in any "direction" of page depths because
  // the whole site tree exists at this point
  for (var path in driveHash) {
    
    if (driveHash[path]['fileIsBlob']) {
      // This is a blob
      logVerbose('Found ' + path + ' in driveHash; it is a blob!');
      
      // The blobParentPath of '/foo/bar/baz-blobs/moose.jpg' will be '/foo/bar/baz'
      var blobParentPath = getBlobParentPathFromPath(path);
      var blobTitleLiteral = driveHash[path]['fileTitleLiteral'];
      
      logVerbose('blobParentPath:' + blobParentPath);
      logVerbose('blobTitleLiteral:' + blobTitleLiteral);
      
      if (!siteHash.hasOwnProperty(path) || driveHash[blobParentPath]['fileLastUpdated'] > siteHash[blobParentPath]['pageLastUpdated']) {  // Some pages that need attachments may have just been created but weren't in the siteHash when the site was read
        // Page has been recently updated in drive; it's worth checking to see if this file needs to be attached
        var page = getPageFromPath(site, blobParentPath);
        var attachments = page.getAttachments();
        var attachmentTitlesArray = [];  // Used later to check if attachments are missing
        
        for (var attachmentNo in attachments) {
          //  Loop through existing attachments and see if any need to be updated
          var attachmentTitle = attachments[attachmentNo].getTitle();  // We always keep the attachment object Title the same as the Drive file's Title (the literal filename)
          attachmentTitlesArray.push(attachmentTitle);  // Gather attachment titles so later we can see if any are missing and need to be added
          
          if (attachmentTitle == blobTitleLiteral) {  // blobTitleLiteral includes the file extension
            // This attachment has a match in the drive and may need to be updated
            var attachmentLastUpdated = attachments[attachmentNo].getLastUpdated();
            
            if (driveHash[path]['fileLastUpdated'] > attachmentLastUpdated) {
              // This attachment has been updated more recently in the Drive than in the Site; update it in the site
              logVerbose('Updating attachment ' + blobTitleLiteral + ' to the page ' + path + '...');
              var fileId = driveHash[path]['fileId'];
              var file = DriveApp.getFileById(fileId);
              var fileBlob = file.getBlob();
              attachments[attachmentNo].setFrom(fileBlob);
              logVerbose('Updated it!');
            }
          }
        }
        
        // Now that we have a list of attachment titles, check to see if the blob title is NOT in there and add it if it's missing
        if (!inArray(blobTitleLiteral, attachmentTitlesArray)) {
          // Found a blob that's missing from the attachment array; add it quick!
          logVerbose('Adding ' + blobTitleLiteral + ' to the page ' + path + '...');
          var fileId = driveHash[path]['fileId'];
          var file = DriveApp.getFileById(fileId);
          var fileBlob = file.getBlob();
          var attachment = page.addHostedAttachment(fileBlob);
          attachment.setTitle(blobTitleLiteral);
          logVerbose('Added it!');
        }
        
      }
    }
  }
}

function createPageClobber(site, path, siteHash, driveHash) {
  // Create page and/or clobber existing published content
  // handle 'false' page ID for 'landing pages'
  
  var fileTitle = driveHash[path]['fileTitle'];
  var fileName = driveHash[path]['fileName']
  var fileId = driveHash[path]['fileId'];
  var fileType = driveHash[path]['fileType'];
  var fileExt = driveHash[path]['fileExt'];
  var fileMd = '';
  var fileHtml = '';
  
  if (!fileId) {
    // fileId is false; there was only a folder for this page; make a landing page
    fileHtml = 'This is the landing page for ' + fileTitle + '.';
  } else {
    Logger.log('');
    Logger.log('About to go into the switch with doc type "' + fileType + '" with an extension of "' + fileExt +'"');
    if (fileType === 'application/vnd.google-apps.document') {
      // This is a Google Doc
      if (fileExt === 'md') {
        Logger.log('This is a Google Doc containing Markdown formatting');
        fileHtml = convertMarkdownDocToHtml(fileId);
      } else {
        Logger.log('This is a Google Doc containing Google Doc formatting');
        fileHtml = convertDocToHtml(fileId);
      }
    } else if (fileType === 'text/plain') {
      Logger.log('This is a plaintext file');
      fileHtml = convertMarkdownFileToHtml(fileId);
    }
  }
  
  if (siteHash[path]) {
    // Page already exists; update page content instead of trying to make a new page
    logVerbose('The HTML I am about to add is this: ' + fileHtml);
    Logger.log('Updating the HTML...');
    var page = getPageFromPath(site, path);
    page.setHtmlContent(fileHtml);
  } else {
    // Page does not already exist; create page and add content
    if (getPathDepth(path) > 0) {
      // Page is not at root of site
      logVerbose('The HTML I am about to add is this: ' + fileHtml);
      var page = site.createWebPage(fileTitle, fileName+'-'+getRandomInt(0, Math.pow(2, 53)), fileHtml); // To avoid colisions because you can't assign the parent yet
      page.setParent(getPageFromPath(site, path.substr(0, path.lastIndexOf('/'))));
      page.setName(fileName);  // Fix the name
    } else {
      logVerbose('The HTML I am about to add is this: ' + fileHtml);
      var page = site.createWebPage(fileTitle, fileName, fileHtml);
    }
  }
}


function createPageNoClobber() {
  // Create page but do not clobber existing published content
}

function removePageFromPath(site, path) {
  var page = getPageFromPath(site, path);
  var pageName = page.getName();
  var renamed = false;
  
  //TODO: delete any attachments?
  // Nope: confirmed on 2015-07-13 that deleting a page deletes the attachments.
  
  while(!renamed) {
    try {
      var movedPageName = pageName+'-'+getRandomInt(0, Math.pow(2, 53));
      page.setName(movedPageName);
      renamed = true;
    } catch(e) {
      // Pick another number next time
    }
  }
  logVerbose('Page got mobed to ' + movedPageName);
  page.deletePage();
  logVerbose('Deleted page at ' + path);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

