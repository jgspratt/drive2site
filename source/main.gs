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


