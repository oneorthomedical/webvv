/*
 * Inspired by AMI.TrackballOrthoControl
 */
const config = require('../viewer.config');
// GUI managment
const guiManager = require('../guiManager');

export default class customControls extends THREE.EventDispatcher {
  constructor(camera, sceneManager, stackCtrl, stacks, domElement, info, chgPtr) {
    super();
    // a simple handler to access "this." attributes from functions not declared as "this."function (aka private)
    let _this = this;

    // a pointer to pass the "haschanged" value by reference { hasChanged: true };
    let changePtr = chgPtr;

    let overlayShoudBeUpdated = true;

    // enum of possible states
    let STATE = {
      SETPROB: 1,
      SETTINGPROB: 2,
      PAN: 3,
      PANNING: 4,
      WINDOW: 5,
      WINDOWING: 6,
      ZOOM: 7,
      ZOOMING: 8,
      SLICE: 9,
      SLICING: 10,
      REGISTER: 11,
      REGISTRING: 12,
      MEASURING: 13,
    };
    // a map of booleans to know which key is down at the moment
    let pressedKeys = new Map();

    // state to determine what the present action is
    this._state = STATE.SETPROB;
    // state to determine what button was selected before doing this action
    // useful to remember the right state even if the user use a shortcut to do another action
    _this._buttonState = STATE.SETPROB;

    // drag and drop helpers
    let oldMousePosition = new THREE.Vector2();
    let newMousePosition = new THREE.Vector2();

    // temp vector to be used for calculations
    let _temp = new THREE.Vector3();
    let cameraResetState;
    let mouseCursorResetState;

    // Public attributes
    this.camera = camera; // as a THREE.js camera (or AMI camera)
    this.stack = stackCtrl; // as a StackHelper, only the main stack
    this.sceneManager = sceneManager;
    this.stackValues = stacks;
    this.information = info;
    this.domElement = (domElement !== undefined) ? domElement : document; // canvas
    this.crossTarget = new THREE.Vector3(); // 3D position of cross cursor (in World)
    /** @property  {Object} this.values object as <pre>
     *    {
     *       positionMM:[x,y,z],
     *       positionPX:[x,y,z],
     *       values:{
     *         background : value of the BG,
     *         fusion : value of the fusion...
     *        },
     *      }
     * </pre>
     * @property {Number[]} this.values.positionMM array of x,y,z cross' position in millimeters
     * @property {Number[]} this.values.positionPX array of x,y,z cross' position in pixels
     * @property {Object} this.values.values dictionnay of layers and their value under the cross
     * @property {Number} this.values.values.background the cross' value in the "background" layer", same goes with other layers
     */
    this.values = {
      positionMM: null,
      positionPX: null,
      data: {},
      roiIn: [],
    };

    this._measure = {
      start: null, // 3D point in the scene
      end: null, // 3D point in the scene
      distance: 0, // distance between those points
      domElement: null,
    }

    this._raycaster = new THREE.Raycaster(); // three js raycaster, only initialized once
    this._mouseRelative = new THREE.Vector2(); // mouse position retalive to canvas x and y in [-1;1]
    this._mouse = new THREE.Vector2(domElement.offsetWidth / 2, domElement.offsetHeight / 2);

    // Useless
    // without that AMI calls missing objects, but we don't need it in our workflow
    this.target = new THREE.Vector3();
    this.handleResize = function() {};
    // end of useless


    this.update = function() {
      updateCrossTarget();
      updateProbValue();
    };

    // Public methods
    this.setAsResetState = function() {
      cameraResetState = this.camera.clone();
      mouseCursorResetState = this._mouse.clone();
    };

    this.reset = function() {
      camera.copy(cameraResetState);

      this.setView(cameraResetState.orientation);

      guiManager.updateIndex();

      this._mouse.copy(mouseCursorResetState);
      changePtr.hasChanged = true;
    };

    // Moves the camera corresponding to a mouse movement from p1 to p2
    this.pan = function(p1, p2) {
      let x = p2.x - p1.x;
      let y = p2.y - p1.y;
      // update graphical cross
      _this._mouse.x += x;
      _this._mouse.y += y;

      // relative movement [-1,1]
      x /= domElement.offsetWidth;
      y /= domElement.offsetHeight;

      // Scale 2D movement to keep 3D world
      let scale_x = (_this.camera.right - _this.camera.left) / _this.camera.zoom;
      let scale_y = (_this.camera.top - _this.camera.bottom) / _this.camera.zoom;
      x *= scale_x;
      y *= scale_y;

      let pan = new THREE.Vector3();
      // vertical component
      pan.copy(_this.camera.up).setLength(y);
      // horizontal component
      pan.add(_temp.copy(_this.camera._right).setLength(-x));
      _this.camera.position.add(pan);
      changePtr.hasChanged = true;
    }

    this.registration = function(p1, p2) {
      let x = p2.x - p1.x;
      let y = p2.y - p1.y;

      // relative movement [-1,1]
      x /= domElement.offsetWidth;
      y /= domElement.offsetHeight;

      // Scale 2D movement to keep 3D world
      let scale_x = (_this.camera.right - _this.camera.left) / _this.camera.zoom;
      let scale_y = (_this.camera.top - _this.camera.bottom) / _this.camera.zoom;
      x *= scale_x;
      y *= scale_y;

      let pan = new THREE.Vector3();
      // vertical component
      pan.copy(_this.camera.up).setLength(y);
      // horizontal component
      pan.add(_temp.copy(_this.camera._right).setLength(-x));

      _this.register(pan);
    }

    this.register = function(pan, absolute) {
      let stack = null;
      if (_this.stackValues.overlay)
        stack = _this.stackValues.overlay;
      else if (_this.stackValues.fusion)
        stack = _this.stackValues.fusion;

      if (stack) {
        // change the "registration" matrix
        if (absolute)
          stack.regMatrix.setPosition(pan);
        else
          stack.regMatrix.multiply(new THREE.Matrix4().makeTranslation(-pan.x, -pan.y, -pan.z));
        // update other matrixes
        stack.computeIJK2LPS();
        stack.computeLPS2AABB();
        // re-link the shader to the right new matrix
        if (_this.stackValues.overlay)
          sceneManager.uniforms.overlay.uWorldToData.value = stack.lps2IJK;
        else
          sceneManager.uniforms.fusion.uWorldToData.value = stack.lps2IJK;
        guiManager.updateRegistration(new THREE.Vector3().setFromMatrixPosition(stack.regMatrix));
      }
      // update active slice for each slice except "image" (already done by StackManager)
      this.sceneManager.updateActiveSlices();
      changePtr.hasChanged = true;
    }

    this.sendRegistration = function() {
      let stack = null;
      let moving = null;
      if (_this.stackValues.overlay) {
        stack = _this.stackValues.overlay;
        moving = 'overlay';
      } else if (_this.stackValues.fusion) {
        stack = _this.stackValues.fusion;
        moving = 'fusion';
      }

      if (stack) {
        let reg = new THREE.Vector3().setFromMatrixPosition(stack.regMatrix);
        let data = {
          registrationJson: {
            fixed: {
              id: _this.information['image'].id,
              table: _this.information['image'].table
            },
            moving: {
              id: _this.information[moving].id,
              table: _this.information[moving].table
            },
            tx: reg.x,
            ty: reg.y,
            tz: reg.z,
          },
          callback: _this.information.callback,
        };

        let xhr = new XMLHttpRequest();
        let url = '/registration';
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-type', 'application/json');
        xhr.responseType = 'json';
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            if (xhr.status == 200 && this.response.done == 'ok') {
              console.log('Registration sent.');
              alert('Registration sent.');
            } else {
              console.log('An error occured while sending the registration.');
            }
          }
        }
        xhr.send(JSON.stringify(data));
      }
    }

    this.zoom = function(directionIn, mouseFactor) {
      // get the speed from the config
      let speed = config.zoomSpeed;
      if (mouseFactor !== undefined)
        speed = mouseFactor + 1; // and correct the speed if it's a mouse zoom (drag and not wheel)
      // factor > 1 to zoom in, factor < 1 to zoom out
      // expl : 1.2 is a 120% zoom (zoom in),  0.8 is a 80% zoom (zoom out)
      let factor = (directionIn) ? 1 / speed : speed;

      if (factor > 0.0) {

        // cross position stuff
        let target1 = null;
        updateMouseRelativePosition();
        _this._raycaster.setFromCamera(_this._mouseRelative, _this.camera);
        let intersectsTarget = this._raycaster.intersectObject(this.stack._slice.children[0]);
        if (intersectsTarget.length > 0) {
          target1 = new THREE.Vector3();
          target1.copy(intersectsTarget[0].point);
        }

        // actually zoom
        this.camera.zoom /= factor;
        this.camera.updateProjectionMatrix();
        updateCrossTarget();

        // and correct the position
        if (target1 !== null) {
          target1.sub(_this.crossTarget);
          _this.camera.position.add(target1);
        }

        changePtr.hasChanged = true;
      }
    }

    this.scrollStack = function(directionTop) {
      if (directionTop) {
        if (this.stack.index >= _this.stack.orientationMaxIndex - 1) {
          return false;
        }
        this.stack.index += 1;
      } else {
        if (this.stack.index <= 0) {
          return false;
        }
        this.stack.index -= 1;
      }
      // update active slice for each slice except "image" (already done by StackManager)
      this.sceneManager.updateActiveSlices();
      changePtr.hasChanged = true;
    }

    this.changeWindow = function(deltaWidth, deltaCenter) {
      // Window width on X
      _this.stack.slice.windowWidth += deltaWidth * config.windowingSpeedFactor;
      _this.stack.slice.windowWidth = Math.min(Math.max(_this.stack.slice.windowWidth, 1), _this.stack._stack.minMax[1] - _this.stack._stack.minMax[0]);
      // Window center on -Y
      _this.stack.slice.windowCenter -= deltaCenter * config.windowingSpeedFactor;
      _this.stack.slice.windowCenter = Math.min(Math.max(_this.stack.slice.windowCenter, _this.stack._stack.minMax[0]), _this.stack._stack.minMax[1]);

      guiManager.windowPreset.window = 'Custom';
      changePtr.hasChanged = true;
    }


    /**
     * local windowing on a 3D cube, its size is config.localWindowingSize / this.camera.zoom
     */
    this.localWindowing = function() {
      let rectCanvas = domElement.getBoundingClientRect();
      let mouseHoverRelative = new THREE.Vector2();
      let hoverTarget = new THREE.Vector3();
      let hoverCoordinates = new THREE.Vector3();
      let stack = _this.stack._stack;

      mouseHoverRelative.x = ((oldMousePosition.x - rectCanvas.left) / rectCanvas.width) * 2 - 1;
      mouseHoverRelative.y = -((oldMousePosition.y - rectCanvas.top) / rectCanvas.height) * 2 + 1;

      _this._raycaster.setFromCamera(mouseHoverRelative, _this.camera);
      let intersectsTarget = _this._raycaster.intersectObject(_this.stack._slice.children[0]);
      if (intersectsTarget.length > 0) {
        hoverTarget.copy(intersectsTarget[0].point);
      }

      hoverCoordinates
        .copy(hoverTarget)
        .applyMatrix4(stack.lps2IJK)
        .addScalar(0.5)
        .floor();

      let minMax = null;
      let temp = new THREE.Vector3().copy(hoverCoordinates);

      let localWindowSize = Math.floor(config.localWindowingSize / this.camera.zoom);
      if (config.maxLocalWindowingSize < localWindowSize)
        localWindowSize = config.maxLocalWindowingSize;

      for (let x = -localWindowSize + 1; x < localWindowSize; x++) {
        temp.x = temp.x + 1;
        temp.y = hoverCoordinates.y;
        temp.z = hoverCoordinates.z;
        for (let y = -localWindowSize + 1; y < localWindowSize; y++) {
          temp.y = temp.y + 1;
          temp.z = hoverCoordinates.z;
          for (let z = -localWindowSize + 1; z < localWindowSize; z++) {
            temp.z = temp.z + 1;
            let value = AMI.UtilsCore.getPixelData(stack, temp);
            if (value)
              if (minMax) {
                if (minMax[0] > value) {
                  minMax[0] = value;
                }
                if (minMax[1] < value) {
                  minMax[1] = value;
                }
              } else {
                minMax = [value, value];
              }
          }
        }
      }
      if (minMax) {
        minMax[0] = AMI.UtilsCore.rescaleSlopeIntercept(minMax[0], stack.rescaleSlope, stack.rescaleIntercept);
        minMax[1] = AMI.UtilsCore.rescaleSlopeIntercept(minMax[1], stack.rescaleSlope, stack.rescaleIntercept);

        _this.stack.slice.windowWidth = minMax[1] - minMax[0] + 1;
        _this.stack.slice.windowCenter = (minMax[0] + minMax[1]) / 2;

        guiManager.windowPreset.window = 'Custom';
        changePtr.hasChanged = true;
      }
    }

    this.prob = function(event) {
      let rect = domElement.getBoundingClientRect();
      let x = event.clientX - rect.left;
      let y = event.clientY - rect.top;
      _this._mouse.x = x;
      _this._mouse.y = y;

      changePtr.hasChanged = true;
    }

    function updateProbValue() {
      _this.values.roiIn = []
      for (let prop in _this.stackValues)
        if (_this.stackValues.hasOwnProperty(prop) && prop != "structs")
          _this.values.data[prop] = getProbValue(_this.stackValues[prop], prop === "image");
        else if (prop == "structs")
        for (let roi of _this.stackValues["structs"])
          if (getProbValue(roi) == 1) {
            _this.values.roiIn.push(roi.name);
          }
      changePtr.hasChanged = true;
    }

    function getProbValue(stack, positionReferential = false) {

      //let dataCoordinates = AMI.UtilsCore.worldToData(stack.lps2IJK, _this.crossTarget);
      // we use the same method as in AMI but keeping floating values :
      let dataCoordinates = new THREE.Vector3()
        .copy(_this.crossTarget)
        .applyMatrix4(stack.lps2IJK)
        .addScalar(0.5);
      if (positionReferential) {
        //display it to the user now
        _this.values.positionMM = _this.crossTarget;
        _this.values.positionPX = new THREE.Vector3().copy(dataCoordinates);
      }

      // then we round : same rounding in the shaders
      dataCoordinates.floor();

      // update value
      let value = AMI.UtilsCore.getPixelData(stack, dataCoordinates);

      return AMI.UtilsCore.rescaleSlopeIntercept(
        value,
        stack.rescaleSlope,
        stack.rescaleIntercept);
    }

    // Update the 3D position of the cross from its 2D position on the screen
    function updateCrossTarget() {
      updateMouseRelativePosition();
      _this._raycaster.setFromCamera(_this._mouseRelative, _this.camera);
      let intersectsTarget = _this._raycaster.intersectObject(_this.stack._slice.children[0]);
      if (intersectsTarget.length > 0) {
        _this.crossTarget.copy(intersectsTarget[0].point);
        _this.sceneManager.target3D = _this.crossTarget; // just a ref not a copy, care if you change it later
      }
    }
    // update the vector _mouse from the position of the mouse on the screen
    function updateMouseRelativePosition() {
      let rectCanvas = domElement.getBoundingClientRect();

      _this._mouseRelative.x = (_this._mouse.x / rectCanvas.width) * 2 - 1;
      _this._mouseRelative.y = -(_this._mouse.y / rectCanvas.height) * 2 + 1;
    }

    function updateMouseFromTarget() {
      let rectCanvas = domElement.getBoundingClientRect();
      let temp = new THREE.Vector3();
      temp.copy(_this.crossTarget);
      temp.project(_this.camera);
      _this._mouseRelative.x = temp.x;
      _this._mouseRelative.y = temp.y;
      _this._mouse.x = (_this._mouseRelative.x + 1) * (rectCanvas.width / 2);
      _this._mouse.y = (-_this._mouseRelative.y + 1) * (rectCanvas.height / 2);
    }

    this.setView = function(orientation) {
      if (_this.camera.orientation == orientation)
        return;

      // disable buttons to show loading
      let state = []
      let buttons = document.getElementsByTagName('button');
      for (let i = 0; i < buttons.length; i++) {
        state[i] = buttons[i].disabled;
        buttons[i].disabled = true;
      }
      document.body.style.cursor = "wait";

      // do the loading 0.1s after, to let the browser update its DOM elements
      setTimeout(function() {
        _this.camera.orientation = orientation;
        _this.camera.update();
        _this.camera.fitBox(2);
        _this.stack.orientation = _this.camera.stackOrientation;

        // update slicing orientation of each stack
        _this.sceneManager.reslice();


        switch (_this.stack.orientation) {
          case 0: // axial
            _this.stack.index = Math.floor(_this.values.positionPX.z - 0.5);
            break;
          case 1: // sagittal
            _this.stack.index = Math.floor(_this.values.positionPX.x - 0.5);
            break;
          case 2: // coronal
            _this.stack.index = Math.floor(_this.values.positionPX.y - 0.5);
            break;
          default:
            let indexMax = _this.stack.orientationMaxIndex;
            _this.stack.index = Math.floor(indexMax / 2);

        }

        updateMouseFromTarget();
        guiManager.updateLabels(_this.camera.directionsLabel, _this.stack._stack.modality);
        changePtr.hasChanged = true;
        guiManager.updateIndex();

        // return to the normal state
        for (let i = 0; i < buttons.length; i++) {
          buttons[i].disabled = state[i];
        }
        document.body.style.cursor = "auto";

      }, 200);
    }


    this.changeCanvasSize = function(size) {
      let temp = new THREE.Vector3().copy(_this.crossTarget);
      domElement.style.maxHeight = size + "px";
      domElement.style.maxWidth = size + "px";
      domElement.style.height = size + "px";

      window.dispatchEvent(new Event('resize'));
      _this.crossTarget.copy(temp);
      updateMouseFromTarget();
      changePtr.hasChanged = true;
    }

    this.updateOverlayCrossPosition = function() {
      if (overlayShoudBeUpdated) {
        let mixUni = sceneManager.uniformsMix;

        if (!mixUni.uOverlayTexture.empty && mixUni.uOverlayCrossMode.value) {

          let rectCanvas = domElement.getBoundingClientRect();
          sceneManager.uniformsMix.uOverlayCrossPosition.value.x =
            ((newMousePosition.x - rectCanvas.left) / rectCanvas.width);
          sceneManager.uniformsMix.uOverlayCrossPosition.value.y = -((newMousePosition.y - rectCanvas.bottom) / rectCanvas.height);
          changePtr.hasChanged = true;

        }
      }
    }

    this.resetMeasure = function() {
      this._measure.start = null;
      // raycast start
      let rectCanvas = domElement.getBoundingClientRect();
      let mouseHoverRelative = new THREE.Vector2();
      mouseHoverRelative.x = ((oldMousePosition.x - rectCanvas.left) / rectCanvas.width) * 2 - 1;
      mouseHoverRelative.y = -((oldMousePosition.y - rectCanvas.top) / rectCanvas.height) * 2 + 1;
      _this._raycaster.setFromCamera(mouseHoverRelative, _this.camera);
      let intersectsTarget = _this._raycaster.intersectObject(_this.stack._slice.children[0]);
      if (intersectsTarget.length > 0) {
        this._measure.start = new THREE.Vector3().copy(intersectsTarget[0].point);
      }
      // reset values
      this._measure.distance = 0;
      this._measure.domElement = null;
    }

    this.measureTo = function() {
      this._measure.end = null;
      // raycast end
      let rectCanvas = domElement.getBoundingClientRect();
      let mouseHoverRelative = new THREE.Vector2();
      mouseHoverRelative.x = ((oldMousePosition.x - rectCanvas.left) / rectCanvas.width) * 2 - 1;
      mouseHoverRelative.y = -((oldMousePosition.y - rectCanvas.top) / rectCanvas.height) * 2 + 1;
      _this._raycaster.setFromCamera(mouseHoverRelative, _this.camera);
      let intersectsTarget = _this._raycaster.intersectObject(_this.stack._slice.children[0]);
      if (intersectsTarget.length > 0) {
        this._measure.end = new THREE.Vector3().copy(intersectsTarget[0].point);
        // update distance
        this._measure.distance = this._measure.start.distanceTo(this._measure.end);
        // update visual element
        sceneManager.updateMeasure(this._measure.start, this._measure.end);
        guiManager.updateRulerMeasure(this._measure.distance)
        // must update to display the line
        changePtr.hasChanged = true;
      }
    }
    this.clearMeasure = function() {
      this._measure.end = null;
      this._measure.distance = 0;
      // update visual element
      sceneManager.updateMeasure(null, null);
      guiManager.updateRulerMeasure(this._measure.distance)
      // must update to display the line
      changePtr.hasChanged = true;
    }

    ///////////
    // Event handlers
    ///////////

    function zoomByDrag(pOld, pNew) {
      _this.zoom(pOld.y > pNew.y, 0.01 * Math.abs(pOld.y - pNew.y));
    }

    function sliceByDrag(pOld, pNew) {
      _this.scrollStack(pOld.y - pOld.x > pNew.y - pNew.x);
    }

    function windowByDrag(pOld, pNew) {
      _this.changeWindow(pNew.x - pOld.x, pNew.y - pOld.y);
    }

    function keypressed(event) {
      switch (event.key) {
        case config.zoomIn:
        case config.zoomIn2:
          _this.zoom(true);
          break;

        case config.zoomOut:
        case config.zoomOut2:
          _this.zoom(false);
          break;

        case config.resetCamera:
          _this.reset();
          break;
        case config.localWindowing:
          _this.localWindowing();
          break;
      }
    }

    function keydown(event) {
      //add this key to the list of pressed keys
      pressedKeys.set(event.keyCode, true);

      switch (event.key) {
        case 'Escape':
          _this._state = STATE.SETPROB;
          _this._buttonState = _this._state;
          break;
        case config.stateZoom:
          _this._state = STATE.ZOOM;
          _this._buttonState = _this._state;
          break;
        case config.stateMove:
          _this._state = STATE.PAN;
          _this._buttonState = _this._state;
          break;
        case config.stateSlice:
          _this._state = STATE.SLICE;
          _this._buttonState = _this._state;
          break;
        case config.stateWindow:
          _this._state = STATE.WINDOW;
          _this._buttonState = _this._state;
          break;
        case config.stateProb:
          _this._state = STATE.SETPROB;
          _this._buttonState = _this._state;
          break;

        case config.stackUp:
          _this.scrollStack(true);
          event.preventDefault();
          break;

        case config.stackDown:
          _this.scrollStack(false);
          event.preventDefault();
          break;
      }
      updateDOM();
    }

    function keyup(event) {
      //remove this key from the list of pressed keys
      pressedKeys.set(event.keyCode, false);
      updateDOM();
    }

    function isDown(keyCode) {
      return pressedKeys.has(keyCode) && pressedKeys.get(keyCode);
    }

    function mousedown(event) {
      switch (event.which) { // which button of the mouse is pressed

        case 1: // left click
          if (isDown(config.moveHold)) {
            _this._state = STATE.PANNING;
          } else if (isDown(config.measureHold)) {
            _this.resetMeasure();
            _this._state = STATE.MEASURING;
          } else {
            switch (_this._state) {
              case STATE.PAN:
                _this._state = STATE.PANNING;
                break;
              case STATE.ZOOM:
                _this._state = STATE.ZOOMING;
                break;
              case STATE.SLICE:
                _this._state = STATE.SLICING;
                break;
              case STATE.WINDOW:
                _this._state = STATE.WINDOWING;
                break;
              case STATE.SETPROB:
                _this._state = STATE.SETTINGPROB;
                _this.prob(event);
                break;
              case STATE.REGISTER:
                _this._state = STATE.REGISTRING;
                break;
            }
          }
          overlayShoudBeUpdated = !overlayShoudBeUpdated;
          break;

        case 2: // middle click
          _this._state = STATE.PANNING;
          event.preventDefault();
          break;

        case 3: //right click
          _this._state = STATE.WINDOWING;
          break;
      }
      oldMousePosition.x = event.clientX;
      oldMousePosition.y = event.clientY;

      updateDOM();
    }

    function mouseup(event) {
      _this._state = _this._buttonState;
      updateDOM();
    }

    function mousemove(event) {
      newMousePosition.x = event.clientX;
      newMousePosition.y = event.clientY;
      switch (_this._state) {
        case STATE.PANNING:
          _this.pan(oldMousePosition, newMousePosition);
          break;
        case STATE.ZOOMING:
          zoomByDrag(oldMousePosition, newMousePosition);
          break;
        case STATE.SLICING:
          sliceByDrag(oldMousePosition, newMousePosition);
          break;
        case STATE.WINDOWING:
          windowByDrag(oldMousePosition, newMousePosition);
          break;
        case STATE.SETTINGPROB:
          _this.prob(event);
          break;
        case STATE.REGISTRING:
          _this.registration(oldMousePosition, newMousePosition);
          break;
        case STATE.MEASURING:
          _this.measureTo();
          break;
      }
      oldMousePosition = newMousePosition.clone();
      _this.updateOverlayCrossPosition();
    }

    function mousewheel(event) {
      if (isDown(config.zoomHold)) {
        _this.zoom((event.deltaY > 0) === config.zoomInIsWheelDown);
        event.preventDefault();
      } else {
        _this.scrollStack((event.deltaY < 0) === config.stackTopIsWheelDown);
        event.preventDefault();
      }
    }

    function contextMenu(event) {
      if (!config.rightClickAllowed)
        event.preventDefault();
    }

    function updateDOM() {
      document.getElementById('button-control-pan').removeAttribute("disabled");
      document.getElementById('button-control-zoom').removeAttribute("disabled");
      document.getElementById('button-control-slice').removeAttribute("disabled");
      document.getElementById('button-control-window').removeAttribute("disabled");
      document.getElementById('button-control-prob').removeAttribute("disabled");
      document.getElementById('button-control-register').removeAttribute("disabled");

      document.getElementById('label-control-pan').classList.add("disabled");
      document.getElementById('label-control-zoom').classList.add("disabled");
      document.getElementById('label-control-slice').classList.add("disabled");
      document.getElementById('label-control-window').classList.add("disabled");
      document.getElementById('label-control-prob').classList.add("disabled");
      document.getElementById('label-control-register').classList.add("disabled");
      switch (_this._state) {
        case STATE.PAN:
        case STATE.PANNING:
          document.getElementById('button-control-pan').setAttribute("disabled", "true");
          document.getElementById('label-control-pan').classList.remove("disabled");
          break;
        case STATE.WINDOW:
        case STATE.WINDOWING:
          document.getElementById('button-control-window').setAttribute("disabled", "true");
          document.getElementById('label-control-window').classList.remove("disabled");
          break;
        case STATE.ZOOM:
        case STATE.ZOOMING:
          document.getElementById('button-control-zoom').setAttribute("disabled", "true");
          document.getElementById('label-control-zoom').classList.remove("disabled");
          break;
        case STATE.SLICE:
        case STATE.SLICING:
          document.getElementById('button-control-slice').setAttribute("disabled", "true");
          document.getElementById('label-control-slice').classList.remove("disabled");
          break;
        case STATE.REGISTER:
        case STATE.REGISTRING:
          document.getElementById('button-control-register').setAttribute("disabled", "true");
          document.getElementById('label-control-register').classList.remove("disabled");
          break;
        case STATE.SETPROB:
        case STATE.SETTINGPROB:
        default:
          document.getElementById('button-control-prob').setAttribute("disabled", "true");
          document.getElementById('label-control-prob').classList.remove("disabled");
          break;
      }
    }

    function setState(evt) {
      switch (evt.target.id) {
        case 'button-control-pan':
          _this._state = STATE.PAN;
          break;
        case 'button-control-zoom':
          _this._state = STATE.ZOOM;
          break;
        case 'button-control-slice':
          _this._state = STATE.SLICE;
          break;
        case 'button-control-window':
          _this._state = STATE.WINDOW;
          break;
        case 'button-control-prob':
          _this._state = STATE.SETPROB;
          break;
        case 'button-control-register':
          _this._state = STATE.REGISTER;
          break;
      }
      _this._buttonState = _this._state;
      updateDOM();
      evt.preventDefault();
    }

    function changeRegistration(evt) {
      let x = document.getElementById("register_x").value;
      let y = document.getElementById("register_y").value;
      let z = document.getElementById("register_z").value;
      _this.register(new THREE.Vector3(x, y, z), true);
    }

    function setView(evt) {
      let orientation = 'default';
      switch (evt.target.id) {
        case 'button-axial':
          orientation = 'axial';
          break;
        case 'button-coronal':
          orientation = 'coronal';
          break;
        case 'button-sagittal':
          orientation = 'sagittal';
          break;
      }
      _this.setView(orientation);

      evt.preventDefault();
    }

    function clearRuler(evt) {
      _this.clearMeasure();
    }

    function setSize(evt) {
      let size = 500;
      switch (evt.target.id) {
        case 'button-size-1':
          size = 500;
          break;
        case 'button-size-2':
          size = 600;
          break;
        case 'button-size-3':
          size = 800;
          break;
      }
      _this.changeCanvasSize(size);
      evt.preventDefault();
    }

    function sendRegistration(evt) {
      _this.sendRegistration();
      evt.preventDefault();
    }

    function resetKeyMap() {
      pressedKeys = new Map();
    }

    function addEvents() {
      // some event are better on the canvas, and others on the whole document.
      domElement.addEventListener('mousedown', mousedown, false);
      document.addEventListener('mouseup', mouseup, false);
      document.addEventListener('wheel', mousewheel, false);
      domElement.addEventListener('contextmenu', contextMenu, false); // Right click
      document.addEventListener('keypress', keypressed, false); // Keys
      document.addEventListener('keyup', keyup, false); // Keys
      document.addEventListener('keydown', keydown, false); // Keys

      document.addEventListener('mousemove', mousemove, false);

      document.getElementById('button-control-pan').addEventListener('click', setState);
      document.getElementById('button-control-zoom').addEventListener('click', setState);
      document.getElementById('button-control-slice').addEventListener('click', setState);
      document.getElementById('button-control-window').addEventListener('click', setState);
      document.getElementById('button-control-prob').addEventListener('click', setState);
      document.getElementById('button-control-register').addEventListener('click', setState);

      document.getElementById('button-clear-ruler').addEventListener('click', clearRuler);

      document.getElementById('register_x').addEventListener('change', changeRegistration);
      document.getElementById('register_y').addEventListener('change', changeRegistration);
      document.getElementById('register_z').addEventListener('change', changeRegistration);
      if (document.getElementById('button-control-send-registration') != null)
        document.getElementById('button-control-send-registration').addEventListener('click', sendRegistration);

      document.getElementById('button-axial').addEventListener('click', setView);
      document.getElementById('button-coronal').addEventListener('click', setView);
      document.getElementById('button-sagittal').addEventListener('click', setView);

      document.getElementById('button-size-1').addEventListener('click', setSize);
      document.getElementById('button-size-2').addEventListener('click', setSize);
      document.getElementById('button-size-3').addEventListener('click', setSize);

      window.addEventListener('blur', resetKeyMap);
    }

    function clearEvents() {
      domElement.removeEventListener('mousedown', mousedown, false);
      document.removeEventListener('mouseup', mouseup, false);
      document.removeEventListener('wheel', mousewheel, false);
      domElement.removeEventListener('contextmenu', contextMenu, false); // Right click
      document.removeEventListener('keypress', keypressed, false); // Keys
      document.removeEventListener('keyup', keyup, false); // Keys
      document.removeEventListener('keydown', keydown, false); // Keys

      document.removeEventListener('mousemove', mousemove, false);

      document.getElementById('button-control-pan').removeEventListener('click', setState);
      document.getElementById('button-control-zoom').removeEventListener('click', setState);
      document.getElementById('button-control-slice').removeEventListener('click', setState);
      document.getElementById('button-control-window').removeEventListener('click', setState);
      document.getElementById('button-control-prob').removeEventListener('click', setState);
      document.getElementById('button-control-register').removeEventListener('click', setState);

      document.getElementById('button-clear-ruler').removeEventListener('click', clearRuler);

      document.getElementById('register_x').removeEventListener('change', changeRegistration);
      document.getElementById('register_y').removeEventListener('change', changeRegistration);
      document.getElementById('register_z').removeEventListener('change', changeRegistration);
      if (document.getElementById('button-control-send-registration') != null)
        document.getElementById('button-control-send-registration').removeEventListener('click', sendRegistration);

      document.getElementById('button-axial').removeEventListener('click', setView);
      document.getElementById('button-coronal').removeEventListener('click', setView);
      document.getElementById('button-sagittal').removeEventListener('click', setView);

      document.getElementById('button-size-1').removeEventListener('click', setSize);
      document.getElementById('button-size-2').removeEventListener('click', setSize);
      document.getElementById('button-size-3').removeEventListener('click', setSize);

      window.removeEventListener('blur', resetKeyMap);
    }

    this.dispose = function() {
      clearEvents();
    };

    //////////////
    // Code executed in constructor
    ///////////

    addEvents();

    this.handleResize();
    this.setAsResetState();
  }

}
