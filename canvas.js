window.requestAnimationFrame = window.requestAnimationFrame
    || window.mozRequestAnimationFrame
    || window.webkitRequestAnimationFrame
    || window.msRequestAnimationFrame
    || function(f){return setTimeout(f, 1000/60)} // simulate calling code 60 
 
window.cancelAnimationFrame = window.cancelAnimationFrame
    || window.mozCancelAnimationFrame
    || function(requestID){clearTimeout(requestID)} //fall back

class CanvasController {
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


    init(canvas) {
        this.canvas = canvas;
        var canvasWidth  = canvas.width;
        var canvasHeight = canvas.height;
        var ctx = canvas.getContext('2d');

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

        this.frameGlobals.interpCursPos.x += 0.5 * (mouseX - this.frameGlobals.interpCursPos.x);
        this.frameGlobals.interpCursPos.y += 0.5 * (mouseY - this.frameGlobals.interpCursPos.y);

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

        for (var [fn, context] of this.frameListeners) {
            fn.call(context, this.frameGlobals);
        }
    }

    writeMessage(message, x, y) {
        this.frameGlobals.ctx.font = '12pt Calibri';
        this.frameGlobals.ctx.fillStyle = 'white';
        this.frameGlobals.ctx.fillText(message, x, y);
    }

    startAnimation () {
        var self = this;
        window.requestAnimationFrame(function _drawFrame() {
            self.drawFrame(self.frameGlobals);
            self.frameGlobals.t += 1;
            window.requestAnimationFrame(_drawFrame);
        });
    }
}