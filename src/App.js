import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";
import * as stream from "stream";
const APP = () => {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  let localVideoRef = useRef(null);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  let pcs = {};
  let id = 1;
  const sendChat = (event) => {
    event.preventDefault();
    setChat([...chat, message]);
    setMessage("");
  };
  const pc_config = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };

  useEffect(() => {
    console.log("useEffect");
    let newSocket = io.connect("http://localhost:8080");

    let localStream = null;

    id = id + 1;

    newSocket.on("all_users", (allUsers) => {
      let len = allUsers.length;
      console.log(users.length);
      for (let i = 0; i < len; i++) {
        createPeerConnection(allUsers[i].id, newSocket, localStream);
        let pc = pcs[allUsers[i].id];
        if (pc) {
          pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          })
            .then((sdp) => {
              console.log("create offer success");
              pc.setLocalDescription(new RTCSessionDescription(sdp));
              newSocket.emit("offer", {
                sdp: sdp,
                offerSendID: newSocket.id,
                offerReceiveID: allUsers[i].id,
              });
            })
            .catch((error) => {
              console.log(error);
            });
        }
      }
    });

    newSocket.on("getOffer", (data) => {
      console.log("get offer");
      createPeerConnection(data.offerSendID, newSocket, localStream);
      let pc = pcs[data.offerSendID];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(
          () => {
            console.log("answer set remote description success");
            pc.createAnswer({
              offerToReceiveVideo: true,
              offerToReceiveAudio: true,
            })
              .then((sdp) => {
                console.log("create answer success");
                pc.setLocalDescription(new RTCSessionDescription(sdp));
                newSocket.emit("answer", {
                  sdp: sdp,
                  answerSendID: newSocket.id,
                  answerReceiveID: data.offerSendID,
                });
              })
              .catch((error) => {
                console.log(error);
              });
          }
        );
      }
    });

    newSocket.on("getAnswer", (data) => {
      console.log("get answer");
      let pc = pcs[data.answerSendID];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
    });

    newSocket.on("getCandidate", (data) => {
      console.log("get candidate");
      let pc = pcs[data.candidateSendID];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate)).then(() => {
          console.log("candidate add success");
        });
      }
    });

    newSocket.on("user_exit", (data) => {
      pcs[data.id].close();
      delete pcs[data.id];
      setUsers((oldUsers) => oldUsers.filter((user) => user.id !== data.id));
    });

    setSocket(newSocket);

    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: {
          width: 240,
          height: 240,
        },
      })
      .then((stream) => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        localStream = stream;
      })
      .catch((error) => {
        console.log(`getUserMedia error: ${error}`);
        stream = new MediaStream();
        localVideoRef.current.srcObject = stream;
        localStream = stream;
      });

    newSocket.emit("join_room", {
      id: 1,
      room: 1,
    });
  }, []);

  const createPeerConnection = (socketID, newSocket, localStream) => {
    let pc = new RTCPeerConnection(pc_config);
    pcs = { ...pcs, [socketID]: pc };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log("onicecandidate");
        newSocket.emit("candidate", {
          candidate: e.candidate,
          candidateSendID: newSocket.id,
          candidateReceiveID: socketID,
        });
      }
    };

    pc.oniceconnectionstatechange = (e) => {
      console.log(e);
    };

    pc.ontrack = (e) => {
      console.log("ontrack success");
      setUsers((oldUsers) => oldUsers.filter((user) => user.id !== socketID));
      setUsers((oldUsers) => [
        ...oldUsers,
        {
          id: socketID,
          stream: e.streams[0],
        },
      ]);
    };

    if (localStream) {
      console.log("localstream add");
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    } else {
      console.log("no local stream");
    }

    return pc;
  };

  const Video = ({ stream, muted, id }) => {
    const ref = useRef(new MediaStream());
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
      if (ref.current) ref.current.srcObject = stream;
      if (muted) setIsMuted(muted);
    });

    return (
      <div className="video-container">
        <video className="video" ref={ref} muted={isMuted} autoPlay></video>
        <div className="userid">{id}</div>
      </div>
    );
  };

  return (
    <div className="p2p-container">
      <div className="videos">
        <video
          className="local-video"
          muted
          ref={localVideoRef}
          autoPlay
        ></video>
        <div className="remote-videos">
          {users.map((user, index) => {
            return <Video key={index} stream={user.stream} id={user.id} />;
          })}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {chat.map((message, index) => (
            <div key={index}>{message}</div>
          ))}
        </div>
        <form onSubmit={sendChat}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};
export default APP;
