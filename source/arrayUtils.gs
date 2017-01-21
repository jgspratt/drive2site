// arrayUtils.gs
////////////////

function inArray(obj, a) {
  // Is the object in the array?
    for (var i = 0; i < a.length; i++) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}


