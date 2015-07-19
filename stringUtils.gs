function stringUtilsTest() {
  Logger.log(removeExtFromFilename('hi.hello.txt'));
  Logger.log(removeExtFromFilename('hello.txt'));
  Logger.log(removeExtFromFilename('hello'));
  Logger.log(removeExtFromFilename(''));
  logVerbose('hello, moose!');
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
