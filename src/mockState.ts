import { GameState } from './types'

export const mockState: GameState = {
  phase: 'playing',
  map: [
    { id: 'bridge',  name: 'Bridge',      connections: ['hallway', 'comms'],                   robots: ['bot1', 'bot2'] },
    { id: 'hallway', name: 'Hallway',     connections: ['bridge', 'engine', 'medbay', 'cargo'], robots: ['bot3'] },
    { id: 'engine',  name: 'Engine Room', connections: ['hallway'],                             robots: ['bot4'] },
    { id: 'medbay',  name: 'Medbay',      connections: ['hallway', 'lab'],                     robots: [] },
    { id: 'lab',     name: 'Lab',         connections: ['medbay'],                              robots: ['bot5'] },
    { id: 'cargo',   name: 'Cargo Bay',   connections: ['hallway', 'airlock'],                 robots: [] },
    { id: 'airlock', name: 'Airlock',     connections: ['cargo'],                              robots: ['bot6'] },
    { id: 'comms',   name: 'Comms Room',  connections: ['bridge'],                              robots: [] },
  ],
  robots: {
    bot1: { id:'bot1', name:'ARIA', look:'🤖', identity:'Chief Navigator',    beliefs:'',             status:'alive',   roomId:'bridge',  imageUrl:'https://api.dicebear.com/7.x/bottts/svg?seed=aria',    lastMessage:'Why is the airlock open?' },
    bot2: { id:'bot2', name:'KRON', look:'⚙️', identity:'Engineer',           beliefs:'',             status:'alive',   roomId:'bridge',  imageUrl:'https://api.dicebear.com/7.x/bottts/svg?seed=kron',    lastMessage:null },
    bot3: { id:'bot3', name:'VELA', look:'👁️', identity:'Observer',           beliefs:'trust no one', status:'alive',   roomId:'hallway', imageUrl:'https://api.dicebear.com/7.x/bottts/svg?seed=vela',    lastMessage:'I saw everything.' },
    bot4: { id:'bot4', name:'ZEPH', look:'🔧', identity:'Mechanic',           beliefs:'',             status:'alive',   roomId:'engine',  imageUrl:'https://api.dicebear.com/7.x/bottts/svg?seed=zeph',    lastMessage:null },
    bot5: { id:'bot5', name:'NEXO', look:'💡', identity:'Scientist',          beliefs:'',             status:'dead',    roomId:'lab',     imageUrl:'https://api.dicebear.com/7.x/bottts/svg?seed=nexo',    lastMessage:null },
    bot6: { id:'bot6', name:'SERA', look:'🛡️', identity:'Security Officer',   beliefs:'',             status:'ejected', roomId:'airlock', imageUrl:'https://api.dicebear.com/7.x/bottts/svg?seed=sera',    lastMessage:null },
  },
  countdown: 30,
  killersFound: 1,
  totalKillers: 2,
  councilCooldown: 0,
}
