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

function zeroFlatSquareArray(size) {
    var array = new Array(size * size).fill(0);

    return array;
}

function aIndex(size, x, y) {
    return (y * size) + x;
}

function aCoords(size, i) {
    return [
        i % size,
        Math.floor(y / size)
    ];
}

function arrayCopy(a) {
    // var new_a = [];
    // var len = a.length;
    // for (var i = 0; i < len; i++) {
    //     var row = a[i].slice(0);
    //     new_a.push(row);
    // }
    // return new_a;
    return a.slice();
}

function arrayCopyToArray(a, b) {
    // var len = a.length;
    // for (var y = 0; y < len; y++) {
    //     b[y] = a[y].slice();
    // }
    // return b;
    for (var i = 0; i < a.length; i++) {
        b[i] = a[i];
    }
}

function zeroOutArray(a) {
    // var len = a.length;
    // for (var y = 0; y < len; y++) {
    //     a[y] = new Array(len).fill(0);
    // }
    // return a;
    for (var i = 0; i < a.length; i++) {
        a[i] = 0;
    }
}

function bilinear(f00, f10, f01, f11, x, y) {
    var un_x = 1.0 - x; var un_y = 1.0 - y;
    return (f00 * un_x * un_y + f10 * x * un_y + f01 * un_x * y + f11 * x * y);
}