function testConvertDocToText() {
  var fileId = '1SksSM-R_6MOHJCwJQNvd-UQ7U3dKwPTWDn82dr9aWFo';
  var plaintext = getDocPlaintext(fileId);
  Logger.log(plaintext);
}


function getDocPlaintext(fileId) {
  var document = DocumentApp.openById(fileId);
  var body = document.getBody();
  var text = body.getText();
  return text;
}
