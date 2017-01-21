// testPage.gs
//////////////

function testParentExists(site, breadcrumb) {
  // Does the whole breadcrumb path exist?
  var parent = getParentFromBreadcrumb(site, breadcrumb, null);
  if (!parent) {
    return false;
  } else {
    return true;
  }
}


function testPageExists(site, pageName, breadcrumb, parent) {
  if (!parent) {
    // We weren't given a parent; go find one
    parent = getParentFromBreadcrumb(site, breadcrumb.slice(), parent);
    if (!parent) {
      // We weren't able to find a parent; the child page can't exist (because the parent hasn't been born yet)
      var pageExists = false;
      return pageExists;
    } else {
      // There is a parent; see if child exists
      page = parent.getChildByName(pageName);
      if (!page) {
        // Child doesn't exist; return false
        return false;
      } else {
        // Child exists; return true
        return true;
      }
    }
  }
}


function testPageExists2(site, pageName) {
  var page = site.getChildByName(pageName);
  if (page === null) {
    return false;
  } else {
    return true;
  }
}


