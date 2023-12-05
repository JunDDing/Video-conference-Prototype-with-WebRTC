// Signaling Server

let express = require("express");
let http = require("http");
let app = express();
let cors = require("cors");
let server = http.createServer(app);
let socketio = require("socket.io");
let io = socketio.listen(server);

app.use(cors());

const PORT = process.env.PORT || 8080;

let users = {};

let socketToRoom = {};

const maximum = process.env.MAXIMUM || 4; // 최대 인원

io.on("connection", (socket) => {
  socket.emit("joined", {
    status: "success",
    message: "You have successfully joined the room.",
  });
  socket.on("join_room", (data) => {
    if (
      // 중복 접속 방지
      users[data.room] &&
      users[data.room].some((user) => user.id === socket.id)
    ) {
      // console.log(`User ${socket.id} is already in the room ${data.room}`);
      return;
    }
    if (users[data.room]) {
      const length = users[data.room].length;
      if (length === maximum) {
        socket.to(socket.id).emit("room_full");
        return;
      }
      users[data.room].push({ id: socket.id, email: data.email });
    } else {
      users[data.room] = [{ id: socket.id, email: data.email }];
    }
    socketToRoom[socket.id] = data.room;

    socket.join(data.room);
    console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

    const usersInThisRoom = users[data.room].filter(
      (user) => user.id !== socket.id
    );

    console.log(usersInThisRoom);

    io.sockets.to(socket.id).emit("all_users", usersInThisRoom);
  });

  socket.on("offer", (data) => {
    // console.log(data.sdp);
    socket.to(data.offerReceiveID).emit("getOffer", {
      sdp: data.sdp,
      offerSendID: data.offerSendID,
      offerSendEmail: data.offerSendEmail,
    });
  });

  socket.on("answer", (data) => {
    // console.log(data.sdp);
    socket
      .to(data.answerReceiveID)
      .emit("getAnswer", { sdp: data.sdp, answerSendID: data.answerSendID });
  });

  socket.on("candidate", (data) => {
    // console.log(data.candidate);
    socket.to(data.candidateReceiveID).emit("getCandidate", {
      candidate: data.candidate,
      candidateSendID: data.candidateSendID,
    });
  });

  socket.on("disconnect", () => {
    console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter((user) => user.id !== socket.id);
      users[roomID] = room;
      if (room.length === 0) {
        delete users[roomID];
        return;
      }
    }
    socket.to(roomID).emit("user_exit", { id: socket.id });
    console.log(users);
  });

  // 클라이언트가 메시지를 보내는 이벤트를 처리합니다.
  socket.on("send_message", (data) => {
    const { room, message } = data;

    // 해당 방에 있는 모든 클라이언트에게 메시지를 전달합니다.
    io.to(room).emit("receive_message", { message, id: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(`server running on ${PORT}`); // 서버 구동 메시지
});