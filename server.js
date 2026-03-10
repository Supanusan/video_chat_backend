require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Allow frontend connection
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
}));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Socket.IO Matchmaking & Signaling logic
const waitingUsers = []; // Simple array to hold waiting users

function broadcastStats() {
  // io.sockets.sockets.size gives only fully-established connections
  io.emit('stats', {
    onlineCount: io.sockets.sockets.size,
    queueCount: waitingUsers.filter(s => s.connected).length,
  });
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  broadcastStats();

  // 1. Join Queue
  socket.on('join-queue', () => {
    // Ignore if user is already in the waiting list
    if (waitingUsers.some(s => s.id === socket.id)) {
       return;
    }

    // Find a valid partner
    let partner = null;
    while (waitingUsers.length > 0) {
      const potentialPartner = waitingUsers.shift();
      if (potentialPartner.connected && potentialPartner.id !== socket.id) {
        partner = potentialPartner;
        break; 
      }
    }

    // If we found a valid partner, match them
    if (partner) {
      const roomId = `room_${socket.id}_${partner.id}`;

      // Join both to the same room
      socket.join(roomId);
      partner.join(roomId);

      // Notify both that a match is found
      // We assign roles: one must be Initiator (creates Offer)
      socket.emit('match-found', { partnerId: partner.id, roomId, isInitiator: true });
      partner.emit('match-found', { partnerId: socket.id, roomId, isInitiator: false });
      
      console.log(`Matched ${socket.id} with ${partner.id} in ${roomId}`);
      broadcastStats();
    } else {
      // Add to waiting queue
      waitingUsers.push(socket);
      console.log(`User ${socket.id} joined the queue.`);
      broadcastStats();
    }
  });

  // 2. WebRTC Signaling Relays
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  // 3. Chat Relay
  socket.on('chat-message', ({ roomId, text }) => {
    socket.to(roomId).emit('chat-message', text);
  });

  // 3b. Typing Indicator
  socket.on('typing', ({ roomId, isTyping }) => {
    socket.to(roomId).emit('typing', { isTyping });
  });

  // 4. Next (Disconnect from current partner, rejoin queue)
  socket.on('next', ({ roomId }) => {
    // Notify partner
    socket.to(roomId).emit('peer-disconnected');
    // Both leave room
    socket.leave(roomId);
  });

  // 5. Disconnect handling
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // If they were in queue, remove them
    const index = waitingUsers.findIndex(s => s.id === socket.id);
    if (index !== -1) {
      waitingUsers.splice(index, 1);
    }
    
    // If they were in a room, notify partner
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('peer-disconnected');
      }
    }
    broadcastStats();
  });
});

// Connect DB placeholder
// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('MongoDB error:', err));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
