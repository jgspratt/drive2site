function stringUtilsTest() {
  Logger.log(removeExtromFilename('hi.hello.txt'));
  Logger.log(removeExtFromFilename('hello.txt'));
  Logger.log(removeExtFromFilename('hello'));
  Logger.log(removeExtFromFilename(''));
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
  var scriptProperties = PropertiesService.getScriptProperties();
  //var verbose = scriptProperties.getProperty('verbose');
  var verbose = 'false';
  if (verbose === 'true') {
    Logger.log(str);
  }
}
