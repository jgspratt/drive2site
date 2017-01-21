function convertMarkdownFileToHtml(docId) {
  var file = DriveApp.getFileById(docId);
  var fileString = file.getBlob().getDataAsString();
  var converter = new Showdown.converter();
  var html = converter.makeHtml(fileString);
  return html;
}

function convertMarkdownStringToHtml(fileString) {
  var converter = new Showdown.converter();
  var html = converter.makeHtml(fileString);
  return html;
}

