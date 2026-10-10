import 'aframe'
import 'mind-ar/dist/mindar-image-aframe.prod.js'
import './style.css'

const BASE_PATH = import.meta.env.BASE_URL
const BOARD_WIDTH = 1.2
const BOARD_HEIGHT = 1.01
const BOARD_GRID_INSET = {
  top: 0.061,
  right: 0.0538,
  bottom: 0.0585,
  left: 0.0525,
}
const BOARD_ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
const DEMO_ONCAK_COORDINATE = { x: 3, y: 4 }
const demoOncakPosition = gridCoordinateToBoardPosition(DEMO_ONCAK_COORDINATE)
const TOTAL_ONCAK = 120
const ONCAK_COLOR_SPLIT = 60
let oncakCoordinate = { ...DEMO_ONCAK_COORDINATE }
let destinationMarkers = []
let selected = false
let moving = false
let explorationMode = false
let activeDivisionGroupCount = 2

document.querySelector('#app').innerHTML = `
  <div class="status-panel" aria-live="polite">
    <p id="tracking-status">Arahkan kamera ke gambar CUKI</p>
    <p id="coordinate-status" hidden></p>
  </div>

  <section class="exploration-panel" aria-label="Eksplorasi Oncak">
    <button id="explore-oncak-button" type="button">Eksplorasi Oncak</button>
    <div id="exploration-content" class="exploration-content" hidden>
      <div class="oncak-groups" aria-label="Kelompok oncak CUKI">
        <div>
          <p>60 oncak hitam</p>
          <div class="oncak-dot-grid oncak-dot-grid--black" aria-hidden="true"></div>
        </div>
        <div>
          <p>60 oncak putih</p>
          <div class="oncak-dot-grid oncak-dot-grid--white" aria-hidden="true"></div>
        </div>
      </div>
      <p class="exploration-question">Berapa jumlah seluruh oncak CUKI?</p>
      <p id="exploration-answer" class="exploration-answer" hidden>60 + 60 = 120 oncak</p>
      <div id="division-content" class="division-content" hidden>
        <p class="exploration-question">Bagaimana jika 120 oncak dibagi sama rata?</p>
        <div class="division-options" aria-label="Pilih jumlah kelompok">
          <button class="division-option" type="button" data-group-count="2">2 kelompok</button>
          <button class="division-option" type="button" data-group-count="3">3 kelompok</button>
          <button class="division-option" type="button" data-group-count="4">4 kelompok</button>
        </div>
        <div id="division-visual" class="division-visual" aria-label="Visualisasi pembagian 120 oncak"></div>
        <p id="division-result" class="exploration-answer" hidden></p>
      </div>
      <div class="exploration-actions">
        <button id="show-answer-button" type="button">Temukan Jawaban</button>
        <button id="try-division-button" type="button" hidden>Coba Bagi Oncak</button>
        <button id="show-division-result-button" type="button" hidden>Temukan Hasil</button>
        <button id="back-to-oncak-exploration-button" type="button" hidden>Kembali ke Eksplorasi Oncak</button>
        <button id="back-to-coordinate-button" type="button">Kembali ke Koordinat</button>
      </div>
    </div>
  </section>

  <a-scene
    mindar-image="imageTargetSrc: ${BASE_PATH}targets.mind; filterMinCF: 0.0001; filterBeta: 0.001"
    color-space="sRGB"
    renderer="colorManagement: true, physicallyCorrectLights"
    vr-mode-ui="enabled: false"
    device-orientation-permission-ui="enabled: false"
    embedded
  >
    <a-assets>
      <img
        id="cuki-board-texture"
        src="${BASE_PATH}assets/papan cuki reborn.jpeg"
        alt="Papan CUKI Reborn"
      />
    </a-assets>

    <a-camera
      position="0 0 0"
      look-controls="enabled: false"
      cursor="rayOrigin: mouse"
      raycaster="objects: .clickable"
    ></a-camera>

    <a-entity id="cuki-target" mindar-image-target="targetIndex: 0">
      <a-plane
        src="#cuki-board-texture"
        position="0 0 0.01"
        rotation="0 0 0"
        width="${BOARD_WIDTH}"
        height="${BOARD_HEIGHT}"
        material="shader: flat; transparent: false"
      ></a-plane>
      <a-cylinder
        id="demo-oncak"
        class="clickable"
        data-grid-x="${DEMO_ONCAK_COORDINATE.x}"
        data-grid-y="${DEMO_ONCAK_COORDINATE.y}"
        data-board-label="${gridCoordinateToBoardLabel(DEMO_ONCAK_COORDINATE)}"
        position="${demoOncakPosition.x} ${demoOncakPosition.y} 0.045"
        rotation="90 0 0"
        radius="0.025"
        height="0.025"
        color="#050505"
        material="roughness: 0.72; metalness: 0.08"
      ></a-cylinder>
    </a-entity>
  </a-scene>
`

const trackingStatus = document.querySelector('#tracking-status')
const coordinateStatus = document.querySelector('#coordinate-status')
const scene = document.querySelector('a-scene')
const cukiTarget = document.querySelector('#cuki-target')
const demoOncak = document.querySelector('#demo-oncak')
const exploreOncakButton = document.querySelector('#explore-oncak-button')
const explorationContent = document.querySelector('#exploration-content')
const explorationAnswer = document.querySelector('#exploration-answer')
const showAnswerButton = document.querySelector('#show-answer-button')
const tryDivisionButton = document.querySelector('#try-division-button')
const divisionContent = document.querySelector('#division-content')
const divisionVisual = document.querySelector('#division-visual')
const divisionResult = document.querySelector('#division-result')
const showDivisionResultButton = document.querySelector('#show-division-result-button')
const backToOncakExplorationButton = document.querySelector('#back-to-oncak-exploration-button')
const backToCoordinateButton = document.querySelector('#back-to-coordinate-button')
const divisionOptionButtons = [...document.querySelectorAll('.division-option')]
let targetVisible = false

demoOncak.addEventListener('click', selectDemoOncak)
scene.addEventListener('renderstart', setupCanvasPointerSelection, { once: true })
exploreOncakButton.addEventListener('click', enterExplorationMode)
showAnswerButton.addEventListener('click', () => {
  explorationAnswer.hidden = false
  tryDivisionButton.hidden = false
})
tryDivisionButton.addEventListener('click', enterDivisionMode)
showDivisionResultButton.addEventListener('click', showDivisionResult)
backToOncakExplorationButton.addEventListener('click', exitDivisionMode)
backToCoordinateButton.addEventListener('click', exitExplorationMode)
divisionOptionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    renderDivisionGroups(Number(button.dataset.groupCount))
  })
})

function selectDemoOncak() {
  if (moving || explorationMode) return

  selected = true
  const boardLabel = gridCoordinateToBoardLabel(oncakCoordinate)
  coordinateStatus.textContent = `Koordinat Oncak: ${boardLabel}`
  coordinateStatus.hidden = false
  setOncakHighlight(true)
  showDestinationMarkers()
}

cukiTarget.addEventListener('targetFound', () => {
  targetVisible = true
  trackingStatus.textContent = 'Papan CUKI terdeteksi'
  document.body.dataset.tracking = 'found'
})

cukiTarget.addEventListener('targetLost', () => {
  targetVisible = false
  trackingStatus.textContent = 'Arahkan kamera ke gambar CUKI'
  coordinateStatus.hidden = true
  clearDestinationMarkers()
  document.body.dataset.tracking = 'lost'
})

function setupCanvasPointerSelection() {
  const canvas = scene.renderer?.domElement
  const camera = scene.camera
  if (!canvas || !camera) return

  const pointer = new AFRAME.THREE.Vector2()
  const raycaster = new AFRAME.THREE.Raycaster()

  canvas.addEventListener('pointerdown', (event) => {
    if (!targetVisible) return
    if (explorationMode) return

    const bounds = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)

    const raycastEntities = [demoOncak, ...destinationMarkers]
    raycastEntities.forEach((entity) => entity.object3D.updateMatrixWorld(true))
    camera.updateMatrixWorld(true)
    raycaster.setFromCamera(pointer, camera)

    const hits = raycaster.intersectObjects(
      raycastEntities.map((entity) => entity.object3D),
      true,
    )
    if (hits.length === 0) return

    const hitEntity = getHitEntity(hits[0].object, raycastEntities)
    if (!hitEntity) return

    event.preventDefault()
    if (hitEntity === demoOncak) {
      selectDemoOncak()
      return
    }

    moveOncakTo({
      x: Number(hitEntity.dataset.targetX),
      y: Number(hitEntity.dataset.targetY),
    })
  })
}

function showDestinationMarkers() {
  clearDestinationMarkers()

  destinationMarkers = getValidDestinations(oncakCoordinate).map((coordinate) => {
    const markerPosition = gridCoordinateToBoardPosition(coordinate)
    const marker = document.createElement('a-cylinder')
    marker.classList.add('clickable', 'destination-marker')
    marker.dataset.targetX = String(coordinate.x)
    marker.dataset.targetY = String(coordinate.y)
    marker.setAttribute('position', `${markerPosition.x} ${markerPosition.y} 0.052`)
    marker.setAttribute('rotation', '90 0 0')
    marker.setAttribute('radius', '0.032')
    marker.setAttribute('height', '0.012')
    marker.setAttribute('color', '#ffd15c')
    marker.setAttribute('material', 'shader: flat; opacity: 0.86; transparent: true')
    cukiTarget.appendChild(marker)
    return marker
  })
}

function clearDestinationMarkers() {
  destinationMarkers.forEach((marker) => marker.remove())
  destinationMarkers = []
}

function moveOncakTo(destination) {
  if (!selected || moving) return

  moving = true
  clearDestinationMarkers()
  const startLabel = gridCoordinateToBoardLabel(oncakCoordinate)
  const endLabel = gridCoordinateToBoardLabel(destination)
  const destinationPosition = gridCoordinateToBoardPosition(destination)

  coordinateStatus.textContent = `Perpindahan Oncak: ${startLabel} \u2192 ${endLabel}`
  coordinateStatus.hidden = false
  demoOncak.setAttribute(
    'animation__move',
    `property: position; to: ${destinationPosition.x} ${destinationPosition.y} 0.045; dur: 450; easing: easeInOutQuad`,
  )

  demoOncak.addEventListener(
    'animationcomplete__move',
    () => {
      oncakCoordinate = { ...destination }
      demoOncak.dataset.gridX = String(oncakCoordinate.x)
      demoOncak.dataset.gridY = String(oncakCoordinate.y)
      demoOncak.dataset.boardLabel = gridCoordinateToBoardLabel(oncakCoordinate)
      moving = false
      selected = false
      setOncakHighlight(false)
    },
    { once: true },
  )
}

function setOncakHighlight(enabled) {
  if (enabled) {
    demoOncak.setAttribute('color', '#111111')
    demoOncak.setAttribute('material', 'roughness: 0.55; metalness: 0.08; emissive: #ffd15c; emissiveIntensity: 0.45')
    return
  }

  demoOncak.setAttribute('color', '#050505')
  demoOncak.setAttribute('material', 'roughness: 0.72; metalness: 0.08')
}

function getValidDestinations(origin) {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
  const destinations = []

  directions.forEach((direction) => {
    for (let distance = 1; distance <= 3; distance += 1) {
      const coordinate = {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
      }

      if (isBoardCoordinate(coordinate)) destinations.push(coordinate)
    }
  })

  return destinations
}

function getHitEntity(object, candidates) {
  let current = object
  while (current) {
    const match = candidates.find((entity) => entity.object3D === current)
    if (match) return match
    current = current.parent
  }

  return null
}

function enterExplorationMode() {
  explorationMode = true
  selected = false
  coordinateStatus.hidden = true
  explorationAnswer.hidden = true
  tryDivisionButton.hidden = true
  exitDivisionMode()
  exploreOncakButton.hidden = true
  explorationContent.hidden = false
  clearDestinationMarkers()
  setOncakHighlight(false)
  demoOncak.setAttribute('visible', 'false')
}

function exitExplorationMode() {
  explorationMode = false
  exitDivisionMode()
  explorationContent.hidden = true
  exploreOncakButton.hidden = false
  demoOncak.setAttribute('visible', 'true')
}

function enterDivisionMode() {
  explorationAnswer.hidden = true
  showAnswerButton.hidden = true
  tryDivisionButton.hidden = true
  divisionContent.hidden = false
  showDivisionResultButton.hidden = false
  backToOncakExplorationButton.hidden = false
  renderDivisionGroups(activeDivisionGroupCount)
}

function exitDivisionMode() {
  divisionContent.hidden = true
  showDivisionResultButton.hidden = true
  backToOncakExplorationButton.hidden = true
  divisionResult.hidden = true
  showAnswerButton.hidden = false
}

function renderDivisionGroups(groupCount) {
  activeDivisionGroupCount = groupCount
  divisionResult.hidden = true
  divisionVisual.replaceChildren()
  divisionOptionButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.groupCount) === groupCount))
  })

  const oncakPerGroup = TOTAL_ONCAK / groupCount
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const group = document.createElement('div')
    group.className = 'division-group'
    group.innerHTML = `<p>Kelompok ${groupIndex + 1}</p>`

    const dots = document.createElement('div')
    dots.className = 'division-dot-grid'
    const startIndex = groupIndex * oncakPerGroup

    for (let dotIndex = 0; dotIndex < oncakPerGroup; dotIndex += 1) {
      const dot = document.createElement('span')
      dot.className = startIndex + dotIndex < ONCAK_COLOR_SPLIT
        ? 'division-dot division-dot--black'
        : 'division-dot division-dot--white'
      dot.style.animationDelay = `${Math.min(dotIndex, 30) * 12}ms`
      dots.appendChild(dot)
    }

    group.appendChild(dots)
    divisionVisual.appendChild(group)
  }
}

function showDivisionResult() {
  const oncakPerGroup = TOTAL_ONCAK / activeDivisionGroupCount
  divisionResult.textContent = `${TOTAL_ONCAK} \u00f7 ${activeDivisionGroupCount} = ${oncakPerGroup} oncak per kelompok`
  divisionResult.hidden = false
}

function gridCoordinateToBoardPosition({ x, y }) {
  const horizontalSpan = 1 - BOARD_GRID_INSET.left - BOARD_GRID_INSET.right
  const verticalSpan = 1 - BOARD_GRID_INSET.top - BOARD_GRID_INSET.bottom
  const textureX = BOARD_GRID_INSET.left + (x / 10) * horizontalSpan
  const textureY = BOARD_GRID_INSET.top + (y / 10) * verticalSpan

  return {
    x: (textureX - 0.5) * BOARD_WIDTH,
    y: (0.5 - textureY) * BOARD_HEIGHT,
  }
}

function gridCoordinateToBoardLabel({ x, y }) {
  const rowLabel = BOARD_ROW_LABELS[y]
  if (!rowLabel || !isBoardCoordinate({ x, y })) {
    throw new RangeError(`Invalid grid coordinate: (${x}, ${y})`)
  }

  return `${rowLabel},${x}`
}

function isBoardCoordinate({ x, y }) {
  return x >= 0 && x <= 10 && y >= 0 && y <= 10
}
