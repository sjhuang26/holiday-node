const websocket = require('ws')
const wss = new websocket.Server({ port: 8000 })

function wsSend(ws, type, payload) {
	ws.send(JSON.stringify({
		type,
		payload
	}))
}

class GamePool {
	constructor() {
		this.games = []
		this.alonePlayer = null
	}

	addPlayer(ws) {
		if (this.alonePlayer === null) {
			this.alonePlayer = ws
			wsSend(ws, 'match', 'waiting for other player')
		} else {
			this.games.push(new Game(this.alonePlayer, ws))
		}
	}
}

const gamePool = new GamePool()

class Game {
	constructor(wsa, wsb) {
		this.pa = new Player(wsa)
		this.pb = new Player(wsb)
		this.currentVillageID = 0
		this.state = {
			villages: {},
			villagesList: []
		}
		this.addVillage([5, 5])
		this.addVillage([6, 6])
		setTimeout(() => {
			this.tick()
		}, 1000)
	}
	
	getNextVillageID() {
		this.currentVillageID += 1
		this.state.villagesList.push(this.currentVillageID)
		return this.currentVillageID
	}

	addVillage(position) {
		this.state.villages[this.getNextVillageID()] = {
			position
		}
	}

	collectVillageResources() {
		this.pa.collectVillageResources(this.state)
		this.pb.collectVillageResources(this.state)
	}

	tick() {
		this.pa.tick()
		this.pb.tick()
		this.collectVillageResources()
		wsSend(this.wsa, 'update', {
			...this.state,
			pa: this.pa.state,
			pb: this.pb.state
		})
		wsSend(this.wsb, 'update', {
			...this.state,
			pa: this.pa.state,
			pb: this.pb.state
		})
	}
}


class Player {
	constructor(ws) {
		this.currentUnitID = 0
		this.state = {
			cheer: 10,
			units: {},
			unitList: []
		}
		this.addUnit()
		this.ws = ws
		this.ws.on('message', (data) => this.message(JSON.parse(data)))
		this.ws.on('close', () => {
			console.log('Connection closed.')
		})
	}

	getNextUnitID() {
		this.currentUnitID++;
		this.state.unitList.push(this.currentUnitID)
		return this.currentUnitID
	}

	tick() {
		for (let unitId of this.state.unitList) {
			this.unitTick(this.state.units[unitId])
		}
	}

	unitTick(unit) {
		const target = unit.target;
		const position = unit.position;

		const dx = target[0] - position[0]
		const dy = target[1] - position[1]
		if (dx > 0) ++target[0];
		if (dx < 0) --target[0];
		if (dy > 0) ++target[1];
		if (dy < 0) --target[1];
	}

	addUnit() {
		this.state.cheer -= 3
		this.state[this.getNextUnitID()] = {
			position: [1, 1],
			target: [1, 1]
		}
	}


	// {type:'add',payload:{}}
	message(data) {
		if (data.type === 'move') {
			for (let unit of data.payload.units) {
				this.state.units[unit].target = data.payload.target;
			}
		}
		if (data.type === 'add') {
			this.addUnit()
		}
	}
	
	collectVillageResources(gameState) {
		for (let villageID of gameState.villageList) {
			const village = gameState.villages[villageID]
			for (let unitID of this.state.unitList) {
				const unit = gameState.units[unitID]
				if (village.position[0] === unit.position[0] && village.position[1] === unit.position[1]) {
					this.state.cheer += 1
				}
			}
		}
	}
}

wss.on('connection', (ws) => {
	console.log('connection')
	wsSend(ws, 'match', 'connection made')
	gamePool.addPlayer(ws)
})