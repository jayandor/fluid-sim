window.requestAnimationFrame = window.requestAnimationFrame
    || window.mozRequestAnimationFrame
    || window.webkitRequestAnimationFrame
    || window.msRequestAnimationFrame
    || function(f){return setTimeout(f, 1000/60)} // simulate calling code 60 
 
window.cancelAnimationFrame = window.cancelAnimationFrame
    || window.mozCancelAnimationFrame
    || function(requestID){clearTimeout(requestID)} //fall back

class WebGLCanvasController {
    canvas = null;

    frameListeners = [];
    frameGlobals = {
        t: 0,
        mousePosition: {
            x: 0,
            y: 0
        },
        interpCursPos: {
            x: 0,
            y: 0
        },
        prevMousePosition: {
            x: 0,
            y: 0
        },
        mouseButton: [false, false, false],
    };
    program = null;
    interpCursorSpeed = 0.2;


    init(canvas) {
        this.canvas = canvas;
        var canvasWidth  = canvas.width;
        var canvasHeight = canvas.height;
        var ctx = canvas.getContext("webgl");

        this.frameGlobals['canvas'] = canvas;
        this.frameGlobals['canvasWidth'] = canvasWidth;
        this.frameGlobals['canvasHeight'] = canvasHeight;
        this.frameGlobals['ctx'] = ctx;

        this.initListeners();
    }

    getMousePosition(canvas, evt) {
        var rect = canvas.getBoundingClientRect();
        var x = evt.clientX - rect.left;
        var y = evt.clientY - rect.top;
        return {
            x: x / canvas.width,
            y: y / canvas.height
        };
    }

    updateInterpCursor() {
        var mouseX = this.frameGlobals.mousePosition.x;
        var mouseY = this.frameGlobals.mousePosition.y;

        this.frameGlobals.prevMousePosition.x = this.frameGlobals.interpCursPos.x;
        this.frameGlobals.prevMousePosition.y = this.frameGlobals.interpCursPos.y;

        this.frameGlobals.interpCursPos.x += this.interpCursorSpeed * (mouseX - this.frameGlobals.interpCursPos.x);
        this.frameGlobals.interpCursPos.y += this.interpCursorSpeed * (mouseY - this.frameGlobals.interpCursPos.y);

    }

    createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) {
            return shader;
        }
     
        console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }

    createProgram(gl, vertexShader, fragmentShader) {
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        var success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (success) {
            return program;
        }
     
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    resize(gl) {
        var realToCSSPixels = window.devicePixelRatio;

        // Lookup the size the browser is displaying the canvas in CSS pixels
        // and compute a size needed to make our drawingbuffer match it in
        // device pixels.
        var displayWidth  = Math.floor(gl.canvas.clientWidth  * realToCSSPixels);
        var displayHeight = Math.floor(gl.canvas.clientHeight * realToCSSPixels);

        // Check if the canvas is not the same size.
        if (gl.canvas.width  !== displayWidth ||
            gl.canvas.height !== displayHeight) {

            // Make the canvas the same size
            gl.canvas.width  = displayWidth;
            gl.canvas.height = displayHeight;
        }
    }

    setRectangle(gl, buffer, x, y, width, height) {
        var x1 = x;
        var x2 = x + width;
        var y1 = y;
        var y2 = y + height;
     
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            x1, y1,
            x2, y1,
            x1, y2,
            x1, y2,
            x2, y1,
            x2, y2]), gl.STATIC_DRAW);
    }

    initGL() {
        var gl = this.frameGlobals.ctx;
        // -----------------------------------------------------------------

        // Create shader program using sources

        var vertexShaderSource = document.getElementById("2d-vertex-shader").text;
        var fragmentShaderSource = document.getElementById("2d-fragment-shader").text;
         
        var vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        var fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

        var program = this.createProgram(gl, vertexShader, fragmentShader);
        this.program = program;

        // -----------------------------------------------------------------

    }

    drawDataToCanvas(imageData) {
        var gl = this.frameGlobals.ctx;

        // Get attribute locations

        var positionAttributeLocation = gl.getAttribLocation(this.program, "a_position");
        var texCoordLocation          = gl.getAttribLocation(this.program, "a_texCoord");

        // Get uniform locations

        var resolutionUniformLocation = gl.getUniformLocation(this.program, "u_resolution");
        var textureSizeLocation       = gl.getUniformLocation(this.program, "u_textureSize");
        // var u_imageLocation           = gl.getUniformLocation(this.program, "u_image");
        var u_densLocation            = gl.getUniformLocation(this.program, "u_dens");

        // -----------------------------------------------------------------

        // Create buffers

        // Create position buffer
        var positionBuffer = gl.createBuffer();
        // Bind position buffer
        // Fill position buffer with data
        this.setRectangle(gl, positionBuffer, 0, 0, image.width, image.height);

        // -------------------------

        // provide texture coordinates for the rectangle.

        // Create texture coordinate buffer
        var texCoordBuffer = gl.createBuffer();
        // Bind texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        // Fill texture coordinate buffer with data
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0,  0.0,
            1.0,  0.0,
            0.0,  1.0,
            0.0,  1.0,
            1.0,  0.0,
            1.0,  1.0]), gl.STATIC_DRAW);

        // -----------------------------------------------------------------

        // Initialize GL canvas

        // Resize canvas
        this.resize(gl);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Tell it to use our program (pair of shaders)
        gl.useProgram(this.program);

        // -----------------------------------------------------------------

        // Create a texture.
        // var imageTexture = gl.createTexture();
        // gl.bindTexture(gl.TEXTURE_2D, imageTexture);

        // // Set the parameters so we can render any size image.
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // // Upload the image into the texture.
        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        // -------------------------

        // Create a texture.
        var dataTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, dataTexture);

        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        var imageData = this.frameListeners[0][0].call(this.frameListeners[0][1], this.frameGlobals);
        var size = Math.sqrt(imageData.length);

        // Upload the data into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, size, size, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, imageData);

        // -------------------------

        // set which texture units to render with.
        // gl.uniform1i(u_imageLocation, 0);  // texture unit 0
        gl.uniform1i(u_densLocation, 0);  // texture unit 1

        // Set each texture unit to use a particular texture.
        // gl.activeTexture(gl.TEXTURE0);
        // gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dataTexture);

        // -----------------------------------------------------------------

        // Enable Vertex Attribute Arrays

        // Enable position attrib array
        gl.enableVertexAttribArray(positionAttributeLocation);
        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 2;          // 2 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        // Get data out of position buffer
        gl.vertexAttribPointer(
            positionAttributeLocation, size, type, normalize, stride, offset);

        // -------------------------

        // Enable texture coordinate attrib array
        gl.enableVertexAttribArray(texCoordLocation);
        // Bind texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

        // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 2;          // 2 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        // Get data out of texture coordinate buffer
        gl.vertexAttribPointer(
            texCoordLocation, size, type, normalize, stride, offset);

        // -----------------------------------------------------------------

        // Set the resolution
        gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
        // set the size of the image
        gl.uniform2f(textureSizeLocation, image.width, image.height);

        // -----------------------------------------------------------------

        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        var count = 6;
        // Draw the rectangle.
        gl.drawArrays(primitiveType, offset, count);

    }

    initListeners() {
        var self = this;
        this.canvas.addEventListener('mousemove', function(evt) {
            self.frameGlobals['prevMousePosition'] = self.frameGlobals['mousePosition'];
            var mousePosition = self.getMousePosition(self.canvas, evt);
            self.frameGlobals['mousePosition'] = mousePosition;
        }, false);

        this.canvas.addEventListener('mousedown', function(evt) {
            var button = evt.button;
            self.frameGlobals['mouseButton'][button] = true;
        }, false);

        this.canvas.addEventListener('mouseup', function(evt) {
            var button = evt.button;
            self.frameGlobals['mouseButton'][button] = false;
        }, false);
    }


    registerFrameListener(fn, context = null) {
        this.frameListeners.push([fn, context]);
    }

    drawFrame() {
        this.updateInterpCursor();

        this.drawDataToCanvas();
    }

    startAnimation () {
        var self = this;
        this.initGL();
        window.requestAnimationFrame(function _drawFrame() {
            self.drawFrame(self.frameGlobals);
            self.frameGlobals.t += 1;
            window.requestAnimationFrame(_drawFrame);
        });
    }
}