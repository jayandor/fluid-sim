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
    densAmount = 100;
    densDiff = 4.9;
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
        this.u = zeroSquareArray(size);
        this.v = zeroSquareArray(size);
        this.dens = zeroSquareArray(size);

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
        var gridSize = grid[0].length;

        for (var i = -this.splatSize; i < this.splatSize; i++) {
            for (var j = -this.splatSize; j < this.splatSize; j++) {
                var splatX = x + i;
                var splatY = y + j;
                if (splatX >= gridSize || splatX < 0
                    || splatY >= gridSize || splatY < 0)
                    continue;

                grid[splatX][splatY] += amount * 1 / (i**2 + j**2 + 0.1);
            }
        }

        return grid;
    }

    diffuse(grid, prev_grid, diff, dt, boundType) {
        var size = grid[0].length;
        var a = dt * diff * size * size;

        for (var k = 0; k < this.diffuseIterations; k++) {
            for (var y = 1; y < size - 1; y++) {
                for (var x = 1; x < size - 1; x++) {
                    var A = (prev_grid[y][x - 1]);
                    var B = (prev_grid[y][x + 1]);
                    var C = (prev_grid[y - 1][x]);
                    var D = (prev_grid[y + 1][x]);
                    var val = (grid[y][x] + a * ( A + B + C + D)) / (1 + 4*a);
                    prev_grid[y][x] = val;
                }
            }
        }

        grid = prev_grid;

        this.setBoundary(grid, boundType);

        return grid;
    }

    advect(grid, u, v, dt, boundType) {
        var size = grid[0].length;

        var new_dens = [];

        for (var y = 0; y < size; y++) {
            var row = [];
            for (var x = 0; x < size; x++) {
                var past_x = x - dt*u[y][x];
                var past_y = y - dt*v[y][x];

                past_x = clamp(past_x, 0.5, size - 2);
                past_y = clamp(past_y, 0.5, size - 2);
                var int_x = Math.floor(past_x);
                var int_y = Math.floor(past_y);

                var s1 = past_x - int_x;
                var s0 = 1 - s1;
                var t1 = past_y - int_y;
                var t0 = 1 - t1;

                var A = t0 * grid[int_y][int_x];
                var B = t1 * grid[int_y+1][int_x];
                var C = t0 * grid[int_y][int_x+1];
                var D = t1 * grid[int_y+1][int_x+1];
                var val = s0 * (A + B) + s1 * (C + D);

                row.push(val);

            }
            new_dens.push(row);
        }

        grid = new_dens;

        this.setBoundary(grid, boundType);

        return grid;
    }

    project(u, v, srcU, srcV) {

        var size = u[0].length;
        var h = 1.0/size;

        for (var y = 1; y < size - 1; y++) {
            for (var x = 1; x < size - 1; x++) {
                var v_val = -0.5 * h * (u[y][x+1] - u[y][x-1] + v[y+1][x] - v[y-1][x]);
                var u_val = 0;
                srcU[y][x] = u_val;
                srcV[y][x] = v_val;
            }
        }
        this.setBoundary(srcV, 0);
        this.setBoundary(srcU, 0);

        for (var k = 0; k < this.projectIterations; k++) {
            for (var y = 1; y < size-1; y++) {
                for (var x = 1; x < size-1; x++) {
                    srcU[y][x] = (srcV[y][x] + srcU[y][x-1] + srcU[y][x+1] + srcU[y-1][x] + srcU[y+1][x]) / 4;
                }
            }
            this.setBoundary(srcU, 0);
        }

        for (var y = 1; y < size - 1; y++) {
            for (var x = 1; x < size - 1; x++) {
                u[y][x] -= 0.5 * (srcU[y][x+1] - srcU[y][x-1])/h;
                v[y][x] -= 0.5 * (srcU[y+1][x] - srcU[y-1][x])/h;
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
        var size = grid.length;

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

        var v00 = grid[x0][y0];
        var v01 = grid[x1][y0];
        var v10 = grid[x0][y1];
        var v11 = grid[x1][y1];
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
            var interp_val = this.dens[ Math.floor(x / scale)][ Math.floor(y / scale)];
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
            // var imageRed = clamp(interp_val, 0, 255);
            // var imageBlue = clamp(2^(interp_val - 180) * 0.5, 0, 255);
            // var imageGreen = clamp(2^(interp_val - 180), 0, 255);

            var h = clamp(1.2 ** (interp_val * 0.03), 0, 50);
            var s = clamp( 1.2 ** (interp_val * 0.02 - 11), 0, 1);
            var l = clamp(interp_val * 0.001, 0, 0.6);

            let c = (1 - Math.abs(2 * l - 1)) * s,
            x = c * (1 - Math.abs((h / 60) % 2 - 1)),
            m = l - c/2,
            r = 0,
            g = 0,
            b = 0;

            if (0 <= h && h < 60) {
                r = c; g = x; b = 0;
            } else if (60 <= h && h < 120) {
                 r = x; g = c; b = 0;
            } else if (120 <= h && h < 180) {
                r = 0; g = c; b = x;
            } else if (180 <= h && h < 240) {
                r = 0; g = x; b = c;
            } else if (240 <= h && h < 300) {
                r = x; g = 0; b = c;
            } else if (300 <= h && h < 360) {
                r = c; g = 0; b = x;
            }
            imageRed   = Math.round((r + m) * 255);
            imageGreen = Math.round((g + m) * 255);
            imageBlue  = Math.round((b + m) * 255);

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

    setBoundary(grid, type) {
        for (var i = 1; i < this.size; i++) {
            if (type == 0) {
                grid[i][0]     = 0;
                grid[i][this.size-1]   = 0;
                grid[0][i]     = 0;
                grid[this.size-1][i]   = 0;
            } else {
                grid[i][0]     = type == 1 ? -grid[i][1]   : grid[i][1];
                grid[i][this.size-1]   = type == 1 ? -grid[i][this.size-2] : grid[i][this.size-2];
                grid[0][i]     = type == 2 ? -grid[1][i]   : grid[1][i];
                grid[this.size-1][i]   = type == 2 ? -grid[this.size-2][i] : grid[this.size-2][i];
            }
        }
        grid[0][0]     = 0.5 * ( grid[0][1] + grid[1][0]);
        grid[this.size-1][0]   = 0.5 * ( grid[this.size-1][1] + grid[this.size-2][0]);
        grid[0][this.size-1]   = 0.5 * ( grid[0][this.size-2] + grid[1][this.size-1]);
        grid[this.size-1][this.size-1] = 0.5 * ( grid[this.size-1][this.size-2] + grid[this.size-2][this.size-1]);
    }

    registerFrameListener(canvasController) {
        canvasController.registerFrameListener(this.updateCanvas, this);
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
        if (frameGlobals.mouseButton[0] || 1) {
            this.splatGrid(this.dens, mouseFluidX, mouseFluidY, this.densAmount * ((mouseFluidY - prevMouseFluidY)**2 + (mouseFluidX - prevMouseFluidX)**2) * 0.06);
        }
        if (frameGlobals.mouseButton[1]) {
            this.splatGrid(this.dens, mouseFluidX, mouseFluidY, -this.densAmount);
        }

        // Add velocity
        if (frameGlobals.mouseButton[2] || frameGlobals.mouseButton[0] || 1) {
            this.splatGrid(this.u, mouseFluidX, mouseFluidY, (mouseFluidY - prevMouseFluidY) * this.velStrength);
            this.splatGrid(this.v, mouseFluidX, mouseFluidY, (mouseFluidX - prevMouseFluidX) * this.velStrength);
        }
    }
};