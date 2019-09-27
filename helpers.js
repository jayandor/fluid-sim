function clamp(x, a, b) {
    return Math.max(Math.min(x, b), a);
}

function zeroSquareArray(size) {
    var array = [];
    for (var i = 0; i < size; i++) {
        var row = [];
        for (var j = 0; j < size; j++) {
            row.push(0);
        }
        array.push(row);
    }

    return array;
}

function arrayCopy(a) {
    var new_a = [];
    var len = a.length;
    for (var i = 0; i < len; i++) {
        var row = a[i].slice(0);
        new_a.push(row);
    }
    return new_a;
}

function bilinear(f00, f10, f01, f11, x, y) {
    var un_x = 1.0 - x; var un_y = 1.0 - y;
    return (f00 * un_x * un_y + f10 * x * un_y + f01 * un_x * y + f11 * x * y);
}