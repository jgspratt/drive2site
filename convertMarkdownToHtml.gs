function convertMarkdownFileToHtml(docId) {
  var file = DriveApp.getFileById(docId);
  var fileString = file.getBlob().getDataAsString();
  var fileStringNoFancyQuotes = stripFancyQuotes(fileString);
  var converter = new Showdown.converter();
  var html = converter.makeHtml(fileStringNoFancyQuotes);
  return html;
}

function convertMarkdownStringToHtml(fileString) {
  var converter = new Showdown.converter();
  var html = converter.makeHtml(fileString);
  return html;
}

