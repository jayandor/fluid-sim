class Fluid {
    dens = [];
    u = [];
    v = [];
    size = 0;
    imageData = null;
    imageWidth = 0;
    imageHeight = 0;


    dt = 0.0001 / 5;
    splatSize = 10;
    velDiff = 0.9;
    velStrength = 3000;
    densAmount = 50;
    densDiff = 0.2;
    diffuseIterations = 4;
    projectIterations = 4;
    imageBackground = false;
    refractBackground = false;
    refractionStrength = 0.02;
    bilinearInterpolate = true;
    fluidIterationsPerFrame = 7;

    buf;
    buf8;
    data;

    init(size) {

        this.size = size;
        this.u = zeroFlatSquareArray(size);
        this.v = zeroFlatSquareArray(size);
        this.dens = zeroFlatSquareArray(size);

        this.splatGrid(this.dens, 10, 6, 100);

        // Load image data
        var img = document.getElementById('image');
        var image_canvas = document.createElement('canvas');
        var image_context = image_canvas.getContext('2d');
        image_canvas.width = img.width;
        image_canvas.height = img.height;
        image_context.drawImage(img, 0, 0, img.width, img.height);
        this.imageData = image_context.getImageData(0, 0, image_canvas.width, image_canvas.height);
        this.imageWidth = img.width;
        this.imageHeight = img.height;

        this.buf  = new ArrayBuffer(this.imageData.data.length);
        this.buf8 = new Uint8ClampedArray(this.buf);
        this.data = new Uint32Array(this.buf);
    }

    splatGrid(grid, x, y, amount) {
        var gridSize = this.size;

        for (var i = -this.splatSize; i < this.splatSize; i++) {
            for (var j = -this.splatSize; j < this.splatSize; j++) {
                var splatX = x + i;
                var splatY = y + j;
                if (splatX >= gridSize || splatX < 0
                    || splatY >= gridSize || splatY < 0)
                    continue;

                grid[ aIndex(gridSize, splatX, splatY) ] += amount * 1 / (i**2 + j**2 + 0.1);
            }
        }

        return grid;
    }

    diffuse(grid, prev_grid, diff, dt, boundType) {
        var size = this.size;
        var a = dt * diff * size * size;

        for (var k = 0; k < this.diffuseIterations; k++) {
            for (var y = 1; y < size - 1; y++) {
                for (var x = 1; x < size - 1; x++) {
                    var A = prev_grid[ aIndex(size, x - 1, y)];
                    var B = prev_grid[ aIndex(size, x + 1, y)];
                    var C = prev_grid[ aIndex(size, x, y - 1)];
                    var D = prev_grid[ aIndex(size, x, y + 1)];
                    var val = (grid[ aIndex(size, x, y) ] + a * ( A + B + C + D)) / (1 + 4*a);
                    prev_grid[ aIndex(size, x, y)] = val;
                }
            }
        }

        grid = prev_grid.slice();

        this.setBoundary(grid, boundType);

        return grid;
    }

    advect(grid, u, v, dt, boundType) {
        var size = this.size;

        var new_dens = [];

        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                var past_x = x - dt*u[ aIndex(size, x, y)];
                var past_y = y - dt*v[ aIndex(size, x, y)];

                past_x = clamp(past_x, 0.5, size - 2);
                past_y = clamp(past_y, 0.5, size - 2);
                var int_x = Math.floor(past_x);
                var int_y = Math.floor(past_y);

                var s1 = past_x - int_x;
                var s0 = 1 - s1;
                var t1 = past_y - int_y;
                var t0 = 1 - t1;

                var A = t0 * grid[ aIndex(size, int_x, int_y)];
                var B = t1 * grid[ aIndex(size, int_x, int_y+1)];
                var C = t0 * grid[ aIndex(size, int_x+1, int_y)];
                var D = t1 * grid[ aIndex(size, int_x+1, int_y+1)];
                var val = s0 * (A + B) + s1 * (C + D);

                new_dens.push(val);
            }
        }

        grid = new_dens.slice();

        this.setBoundary(grid, boundType);

        return grid;
    }

    project(u, v, srcU, srcV) {

        var size = this.size;
        var h = 1.0/size;

        for (var y = 1; y < size - 1; y++) {
            for (var x = 1; x < size - 1; x++) {
                var v_val = -0.5 * h * (u[ aIndex(size, x+1, y)] - u[ aIndex(size, x-1, y)] + v[ aIndex(size, x, y+1)] - v[ aIndex(size, x, y-1)]);
                var u_val = 0;
                srcU[ aIndex(size, x, y)] = u_val;
                srcV[ aIndex(size, x, y)] = v_val;
            }
        }
        this.setBoundary(srcV, 0);
        this.setBoundary(srcU, 0);

        for (var k = 0; k < this.projectIterations; k++) {
            for (var y = 1; y < size-1; y++) {
                for (var x = 1; x < size-1; x++) {
                    srcU[ aIndex(size, x, y)] = (srcV[ aIndex(size, x, y)] + srcU[ aIndex(size, x-1, y)] + srcU[ aIndex(size, x+1, y)] + srcU[ aIndex(size, x, y-1)] + srcU[ aIndex(size, x, y+1)]) / 4;
                }
            }
            this.setBoundary(srcU, 0);
        }

        for (var y = 1; y < size - 1; y++) {
            for (var x = 1; x < size - 1; x++) {
                u[ aIndex(size, x, y)] -= 0.5 * (srcU[ aIndex(size, x+1, y)] - srcU[ aIndex(size, x-1, y)])/h;
                v[ aIndex(size, x, y)] -= 0.5 * (srcU[ aIndex(size, x, y+1)] - srcU[ aIndex(size, x, y-1)])/h;
            }
        }
        this.setBoundary(u, 1);
        this.setBoundary(v, 2);
    }

    updateFluid() {
        var dens0 = arrayCopy(this.dens);
        var u0 = arrayCopy(this.u);
        var v0 = arrayCopy(this.v);

        var srcU = arrayCopy(this.u);
        var srcV = arrayCopy(this.v);

        // Density
        this.dens = this.diffuse(this.dens, dens0, this.densDiff, this.dt, 0);
        this.dens = this.advect(this.dens, this.u, this.v, this.dt, 0);
        // Velocity
        this.u = this.diffuse(this.u, u0, this.velDiff, this.dt, 1);
        this.v = this.diffuse(this.v, v0, this.velDiff, this.dt, 2);
        this.project(this.u, this.v, srcU, srcV);
        this.advect(this.u, this.u, this.v, this.dt, 1);
        this.advect(this.v, this.u, this.v, this.dt, 2);
        this.project(this.u, this.v, srcU, srcV);
    }

    getInterpGrid(grid, x, y, scale) {
        var size = this.size;

        var grid_x = Math.floor(x / scale);
        var grid_y = Math.floor(y / scale);

        grid_x = grid_x < 0 ? 0 : (grid_x > size-1 ? size-1 : grid_x);
        grid_y = grid_y < 0 ? 0 : (grid_y > size-1 ? size-1 : grid_y);

        var x0 = grid_x;
        var y0 = grid_y;
        var x1 = grid_x+1;
        var y1 = grid_y+1;

        if (grid_x == size - 1) x1 = x0;
        if (grid_y == size - 1) y1 = y0;

        var v00 = grid[ aIndex(size, y0, x0)];
        var v01 = grid[ aIndex(size, y0, x1)];
        var v10 = grid[ aIndex(size, y1, x0)];
        var v11 = grid[ aIndex(size, y1, x1)];
        var interp_val = bilinear(v00, v01, v10, v11, (x % scale) / scale, (y % scale) / scale);

        return interp_val;
    }

    getColorIndicesForCoord(x, y, width) {
        var red = y * (width * 4) + x * 4;
        return [red, red + 1, red + 2, red + 3];
    }

    getFluidPixel(frameGlobals, x, y) {
        var canvasWidth = frameGlobals.canvasWidth;
        var scale = Math.floor(canvasWidth / this.size);

        if (this.bilinearInterpolate) {
            var interp_val = this.getInterpGrid(this.dens, x, y, scale);
        } else {
            var interp_val = this.dens[ aIndex(this.size,  Math.floor(y / scale),  Math.floor(x / scale))];
        }

        if (this.imageBackground) {

            if (this.refractBackground) {
                var imageX = clamp(Math.round(x + interp_val * this.refractionStrength), 0, this.imageWidth);
                var imageY = clamp(Math.round(y + interp_val * this.refractionStrength), 0, this.imageHeight);
            } else {
                var imageX = x;
                var imageY = y;
            }

            var redI = imageY * (this.imageWidth * 4) + imageX * 4;
            var greenI = redI + 1;
            var blueI  = redI + 2;
            var alphaI = redI + 3;

            var imageRed = this.imageData.data[redI];
            var imageGreen = this.imageData.data[greenI];
            var imageBlue = this.imageData.data[blueI];
            var imageAlpha = this.imageData.data[alphaI];
            imageRed   = clamp( imageRed + (interp_val > 0 ? interp_val : 0) * interp_val * 0.005, 0, 255);
            imageGreen = clamp( imageGreen + (interp_val > 0 ? interp_val : 0) * interp_val * 0.001, 0, 255);
            //imageBlue  = clamp( (imageBlue - 2 ** (interp_val*0.002-2) * 29.7), 0, 255);
        } else {

            // Flame
            var imageRed = clamp(interp_val, 0, 255);
            var imageBlue = clamp(2^(interp_val - 180) * 0.5, 0, 255);
            var imageGreen = clamp(2^(interp_val - 180), 0, 255);

        }

        var data =
            (255        << 24) |    // alpha
            (imageBlue  << 16) |    // blue
            (imageGreen <<  8) |    // green
             imageRed;              // red

        return data;
    }

    updateCanvas(frameGlobals) {
        var ctx = frameGlobals.ctx;
        var canvasWidth = frameGlobals.canvasWidth;
        var canvasHeight = frameGlobals.canvasHeight;

        var imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

        for (var y = 0; y < canvasHeight; y++) {
            for (var x = 0; x < canvasWidth; x++) {
                this.data[y * canvasWidth + x] = this.getFluidPixel(frameGlobals, x, y);
            }
        }

        imageData.data.set(this.buf8);

        ctx.putImageData(imageData, 0, 0);

        for (var i = 0; i < this.fluidIterationsPerFrame; i++) {
            this.addFluid(frameGlobals);
            this.updateFluid(frameGlobals);
        }
    }

    gridToImageData(grid) {
        // var data = [];
        // var size = this.size;
        // for (var i = 0; i < size * size; i++) {
        //     var y = Math.floor(i / size);
        //     var x = i % size;
        //     data.push(clamp(grid[ aIndex(size, y, x)], 0, 255)); // R
        // }
        var data = [];
        var size = grid.length;
        for (var i = 0; i < size; i++) {
            data.push(clamp(grid[i], 0, 255)); // R
        }
        return new Uint8Array(data);
    }

    updateCanvasGL(frameGlobals) {

        var ctx = frameGlobals.ctx;
        var canvasWidth = frameGlobals.canvasWidth;
        var canvasHeight = frameGlobals.canvasHeight;

        for (var i = 0; i < this.fluidIterationsPerFrame; i++) {
            this.addFluid(frameGlobals);
            this.updateFluid(frameGlobals);
        }

        var imageData = this.gridToImageData(this.dens);
        return imageData;
    }

    setBoundary(grid, type) {
        for (var i = 1; i < this.size; i++) {
            if (type == 0) {
                grid[ aIndex(this.size, 0, i)]     = 0;
                grid[ aIndex(this.size, this.size-1, i)]   = 0;
                grid[ aIndex(this.size, i, 0)]     = 0;
                grid[ aIndex(this.size, i, this.size-1)]   = 0;
            } else {
                grid[ aIndex(this.size, 0, i)]     = type == 1 ? -grid[ aIndex(this.size, 1, i)]   : grid[ aIndex(this.size, 1, i)];
                grid[ aIndex(this.size, this.size-1, i)]   = type == 1 ? -grid[ aIndex(this.size, this.size-2, i)] : grid[ aIndex(this.size, this.size-2, i)];
                grid[ aIndex(this.size, i, 0)]     = type == 2 ? -grid[ aIndex(this.size, i, 1)]   : grid[ aIndex(this.size, i, 1)];
                grid[ aIndex(this.size, i, this.size-1)]   = type == 2 ? -grid[ aIndex(this.size, i, this.size-2)] : grid[ aIndex(this.size, i, this.size-2)];
            }
        }
        grid[ aIndex(this.size, 0, 0)]     = 0.5 * ( grid[ aIndex(this.size, 1, 0)] + grid[ aIndex(this.size, 0, 1)]);
        grid[ aIndex(this.size, 0, this.size-1)]   = 0.5 * ( grid[ aIndex(this.size, 1, this.size-1)] + grid[ aIndex(this.size, 0, this.size-2)]);
        grid[ aIndex(this.size, this.size-1, 0)]   = 0.5 * ( grid[ aIndex(this.size, this.size-2, 0)] + grid[ aIndex(this.size, this.size-1, 1)]);
        grid[ aIndex(this.size, this.size-1, this.size-1)] = 0.5 * ( grid[ aIndex(this.size, this.size-2, this.size-1)] + grid[ aIndex(this.size, this.size-1, this.size-2)]);
    }

    registerFrameListener(canvasController) {
        canvasController.registerFrameListener(this.updateCanvasGL, this);
    }

    addFluid(frameGlobals) {

        var canvasWidth = frameGlobals.canvasWidth;
        var canvasHeight = frameGlobals.canvasHeight;

        var scale = Math.floor(canvasWidth / this.size);

        var mouseX = frameGlobals.interpCursPos.x;
        var mouseY = frameGlobals.interpCursPos.y;
        var mousePixX = mouseX * canvasWidth;
        var mousePixY = mouseY * canvasWidth;
        var mouseFluidX = Math.floor(mousePixX / scale);
        var mouseFluidY = Math.floor(mousePixY / scale);

        var prevMouseX = frameGlobals.prevMousePosition.x;
        var prevMouseY = frameGlobals.prevMousePosition.y;
        var prevMousePixX = prevMouseX * canvasWidth;
        var prevMousePixY = prevMouseY * canvasWidth;
        var prevMouseFluidX = Math.floor(prevMousePixX / scale);
        var prevMouseFluidY = Math.floor(prevMousePixY / scale);

        // Add density
        if (frameGlobals.mouseButton[0]) {
            this.splatGrid(this.dens, mouseFluidX, mouseFluidY, this.densAmount * ((mouseFluidY - prevMouseFluidY)**2 + (mouseFluidX - prevMouseFluidX)**2) * 0.06);
        }
        if (frameGlobals.mouseButton[1]) {
            this.splatGrid(this.dens, mouseFluidX, mouseFluidY, -this.densAmount);
        }

        // Add velocity
        if (frameGlobals.mouseButton[2]) {
            this.splatGrid(this.u, mouseFluidX, mouseFluidY, (mouseFluidX - prevMouseFluidX) * this.velStrength);
            this.splatGrid(this.v, mouseFluidX, mouseFluidY, (mouseFluidY - prevMouseFluidY) * this.velStrength);
        }
    }
};