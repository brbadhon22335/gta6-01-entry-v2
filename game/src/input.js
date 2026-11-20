// Keyboard and mouse state. One-shot actions (steal, punch, shoot, pause,
// confirm, new game, mute) are edge-triggered: the game reads them once
// per frame, then they are cleared.

export function createInput(screenToWorld) {
  const keys = new Set();
  const state = {
    moveX: 0,
    moveY: 0,
    run: false,
    aim: { x: 0, y: 0 },
    mouseDown: false,
    steal: false,
    punch: false,
    shoot: false,
    pause: false,
    confirm: false,
    newGame: false,
    mute: false,
  };

  function updateMove() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    state.moveX = len > 0 ? x / len : 0;
    state.moveY = len > 0 ? y / len : 0;
    state.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  }

  function updateAim(clientX, clientY) {
    state.aim = screenToWorld(clientX, clientY);
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') state.steal = true;
    if (event.code === 'KeyF') state.punch = true;
    if (event.code === 'KeyP' || event.code === 'Escape') state.pause = true;
    if (event.code === 'Space' || event.code === 'Enter') {
      state.confirm = true;
      event.preventDefault();
    }
    if (event.code === 'KeyN') state.newGame = true;
    if (event.code === 'KeyM') state.mute = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    updateMove();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    updateMove();
  }

  function onMouseMove(event) {
    updateAim(event.clientX, event.clientY);
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    updateAim(event.clientX, event.clientY);
    state.mouseDown = true;
    state.shoot = true;
    state.confirm = true;
  }

  function onMouseUp(event) {
    if (event.button !== 0) return;
    state.mouseDown = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function clearActions() {
    state.steal = false;
    state.punch = false;
    state.shoot = false;
    state.pause = false;
    state.confirm = false;
    state.newGame = false;
    state.mute = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('contextmenu', onContextMenu);

  return { state, clearActions };
}
