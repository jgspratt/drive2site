function syncPages(site, siteHash, driveHash) {
  // Goes through the whole site and adds missing content
  
  var maxPathDepth = getMaxPathDepth(driveHash);
  
  Logger.log('');
  Logger.log('We found that the maxPathDepth is ' + maxPathDepth);
  Logger.log('');
  
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
  
  for (var i = 0; i <= maxPathDepth ; i++) {  // Start creating from the highest level
    var pathDepth = 0;
    for (var path in driveHash) {
      pathDepth = getPathDepth(path);
      if (pathDepth === i) {
        // We are looking at paths at the right level (nearest 0 remaining) now
        if (!siteHash[path] || driveHash[path]['fileLastUpdated'] > siteHash[path]['pageLastUpdated']) {
          try {
            logVerbose('Found ' + path + ' in driveHash; adding or updating...');
            logVerbose('siteHash[path]:' + siteHash[path]);
            logVerbose("driveHash[path]['fileLastUpdated']:" + driveHash[path]['fileLastUpdated']);
            logVerbose("siteHash[path]['pageLastUpdated']:" + siteHash[path]['pageLastUpdated']);
            logVerbose( driveHash[path]['fileLastUpdated'] > siteHash[path]['pageLastUpdated']);
          } catch(e) {
            // pageLastUpdated may not actually exist because this may be a new page.
          }
          //Page does not exist yet or is older tha drive.; update page
          createPageClobber(site, path, siteHash, driveHash);
          Logger.log('CreatedOrUpdated ' + path + '!');
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
    //Logger.log('The HTML I am about to add is this: ' + fileHtml);
    Logger.log('Updating the HTML...');
    var page = getPageFromPath(site, path);
    page.setHtmlContent(fileHtml);
  } else {
    // Page does not already exist; create page and add content
    if (getPathDepth(path) > 0) {
      // Page is not at root of site
      //Logger.log('The HTML I am about to add is this: ' + fileHtml);
      var page = site.createWebPage(fileTitle, fileName+'-'+getRandomInt(0, Math.pow(2, 53)), fileHtml); // To avoid colisions because you can't assign the parent yet
      page.setParent(getPageFromPath(site, path.substr(0, path.lastIndexOf('/'))));
      page.setName(fileName);  // Fix the name
    } else {
      //Logger.log('The HTML I am about to add is this: ' + fileHtml);
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
  while(!renamed) {
    try {
      page.setName(pageName+'-'+getRandomInt(0, Math.pow(2, 53)));
      renamed = true;
    } catch(e) {
      // Pick another number next time
    }
  }
  page.deletePage();
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
