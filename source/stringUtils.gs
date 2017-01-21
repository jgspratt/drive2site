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