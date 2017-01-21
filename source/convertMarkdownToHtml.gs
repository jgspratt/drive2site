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


