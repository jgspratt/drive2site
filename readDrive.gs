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
  // Pass in parentPath as ''; it's for recursion
  
  var childFolders = parentFolder.getFolders();
  var childFiles = parentFolder.getFiles();
  var parentFolderTitle = parentFolder.getName();
  var parentFolderName = convertTitleToUrlSafe(parentFolderTitle);
  
  // These are the mimeTypes of supported files
  var supportedTypes = [
    'application/vnd.google-apps.document',
    'text/plain',
  ];
  
  // Ensure parent exists in driveHash
  // Needed to ensure parents are created before children are born.  For tax purposes.
  if (!driveHash[parentFolderPath] && parentFolderPath !== '') {
    // Child exists but no parent page exists; create a generic page in the hash.
    driveHash[parentFolderPath] = {'fileId':false, 'fileName':parentFolderName, 'fileTitle':parentFolderTitle};
  }
  
  logVerbose('Gathering all files in ' + parentFolderTitle + '...');
  while (childFiles.hasNext()) {
    var childFile = childFiles.next();
    var childFileType = childFile.getMimeType();
    if (inArray(childFileType, supportedTypes)){
      var childFileId = childFile.getId();
      var childFileTitleLiteral = childFile.getName();  // Literally what is displayed in the drive
      var childFileTitle = removeExtFromFilename(childFileTitleLiteral);  // Everything, minus the dot and extension
      var childFileExt = extFromFilename(childFileTitleLiteral);  // The file extension
      var childFileName = convertTitleToUrlSafe(childFileTitle);  // This is the URL safe (like-this)
      var childFilePath = parentFolderPath + '/' + childFileName;
      var childFileLastUpdated = childFile.getLastUpdated();
      
      logVerbose('Adding a file to the array: ' + childFilePath + ' of type: ' + childFileType);
      logVerbose('fileId:' + childFileId);
      logVerbose('fileTitleLiteral:' + childFileTitleLiteral);
      logVerbose('fileTitle:' + childFileTitle);
      logVerbose('fileExt:' + childFileExt);
      logVerbose('fileName:' + childFileName);
      driveHash[childFilePath] = {
        'fileId':childFileId, 
        'fileTitleLiteral':childFileTitleLiteral,
        'fileTitle':childFileTitle,
        'fileExt':childFileExt,
        'fileName':childFileName, 
        'fileType':childFileType,
        'fileLastUpdated':childFileLastUpdated,
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


function convertTitleToUrlSafe(fileTitle) {
  var fileTitleLower = fileTitle.toLowerCase();
  var fileTitleLowerSpaced = fileTitleLower.replace(/-/g, ' ');  // Turns '2015-02-21' into '2015 02 21' so it gets dashed later
  var fileTitleLowerStripped = fileTitleLowerSpaced.replace(/[^\w\s]|_/g, "")
  var fileTitleLowerStrippedDashed = fileTitleLowerStripped.replace(/\s+/g, "-");
  return fileTitleLowerStrippedDashed;
}

