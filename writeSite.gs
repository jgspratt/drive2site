function syncPages(site, siteHash, driveHash) {
  // Goes through the whole site and adds missing content
  
  var maxPathDepth = getMaxPathDepth(driveHash);
  
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
    if (driveHash[path]['fileLastUpdated'] > siteHash[path]['pageLastUpdated']) {
      // File has been recently updated in drive; check to see if attachments have been removed (we need to delete them)
      
      var page = getPageFromPath(site, path);
      var attachments = page.getAttachments();
      
      for (var attachmentNo in attachments) {
        var attachment = attachments[attachmentNo];
        var attachmentTitle = attachment.getTitle();
        var attachmentName = convertTitleToUrlSafe(attachmentTitle);  // We don't strip the extension from blobs.  See related note in readDrive.gs
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
  
  
  // Create pages that exist in the Drive but not in the Site
  for (var i = 0; i <= maxPathDepth ; i++) {  // Start creating from the highest level
    var pathDepth = 0;
    for (var path in driveHash) {
      pathDepth = getPathDepth(path);
      if (pathDepth === i) {
        // We are looking at paths at the right level (nearest 0 remaining) now
        if ((!siteHash[path] || driveHash[path]['fileLastUpdated'] > siteHash[path]['pageLastUpdated']) && !driveHash[path]['fileIsBlob']) {
          //Page does not exist yet or is older tha drive; update page
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
      
      if (driveHash[blobParentPath]['fileLastUpdated'] > siteHash[blobParentPath]['pageLastUpdated']) {  // TODO: this errored "pageLastUpdated" from undefined"--I think it was because the page didn't exist in the site yet for some reason, but I don't how that's possible yet
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
        // This is a Google Doc containing Markdown formatting
        fileMd = getDocPlaintext(fileId);
        fileHtml = convertMarkdownStringToHtml(fileMd);
      } else {
        // This is a Google Doc containing Google Doc formatting
        fileHtml = convertDocToHtml(fileId);
      }
    } else if (fileType === 'text/plain') {
      // Plaintext file
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
