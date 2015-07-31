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
    var childFolderPath = parentFolderPath + '/' + childFolderName;
    readDriveToHash(driveHash, childFolder, childFolderPath);
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


