import { Title, Text, TextInput, Button, SimpleGrid, Container, Space, Group, Card, Textarea, Code, Divider, useMantineColorScheme } from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { Peer } from 'peerjs'
import { ColorSchemeToggle } from '../ColorSchemeToggle/ColorSchemeToggle';
import { notifications } from '@mantine/notifications';

function makeRandomId(length : number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

export function JoinRoomView() {

    const randomGeneratedId = useRef(makeRandomId(8));
    const currentPeerId = useRef("");
    useEffect(() => {
        if (inputRoom === undefined) {
            if (window.location.hash && window.location.hash !== "#") {
                {/* @ts-ignore */}
                setInputRoom(window.location.hash.split("#")[1]);
            }
        }

        if (inputName === undefined) {
            if (localStorage.getItem("PointPokerName") != null) {
                {/* @ts-ignore */}
                setInputName(localStorage.getItem("PointPokerName"));
            }
        }
    });

    // Let's try something
    let globalPeerJS : any = useRef(null);
    let globalPeerJSRefCon : any = useRef(null);
    let globalPeerJSRefData : any = useRef({
        connections: [],
        voteData: {},
        issueData: {}
    });

    const isRoomHost = useRef(false);
    const [currentPageView, setCurrentPageView] = useState('login');
    const [inputName, setInputName] = useState(undefined);
    const [inputRoom, setInputRoom] = useState(undefined);

    const [currentIssueTitle, setCurrentIssueTitle] = useState('');
    const [currentIssueDescription, setCurrentIssueDescription] = useState('');
    const [currentSelectedVote, setCurrentSelectedVote] = useState('');
    const [currentVoteCount, setCurrentVoteCount] = useState(0);
    const [currentConnectionCount, setCurrentConnectionCount] = useState(1);

    const { setColorScheme } = useMantineColorScheme();

    function resetReactVoteData() {
        setCurrentIssueTitle('');
        setCurrentIssueDescription('');
        setCurrentSelectedVote('');
        setCurrentVoteCount(0);
        globalPeerJSRefData.current.voteData = {};
        globalPeerJSRefData.current.issueData = {};
    }

    function onPeerJSNewConnection(conn : any) {
        console.log("GOT A NEW CONNECTION!");
        globalPeerJSRefData.current.connections.push(conn);
        setCurrentConnectionCount(currentConnectionCount + 1);

        conn.on("data", function(data:any) {
            onPeerJSData(data)
        });
    }
    function onPeerJSData(data : any) {
        try {
            let dataJSON = JSON.parse(data);

            if (dataJSON["Action"] === "SetCurrentView") {
                setCurrentPageView(dataJSON.View);
            }
            else if (dataJSON["Action"] === "SetIssueData") {
                setCurrentIssueTitle(dataJSON.Title);
                setCurrentIssueDescription(dataJSON.Description);
            }
            else if (dataJSON["Action"] === "SayHello") {
                notifications.show({
                    title: 'New User',
                    message: `${dataJSON.Name} - has joined the room`,
                });
                if (isRoomHost.current) {
                    for (let i = 0; i < globalPeerJSRefData.current.connections.length; i++) {
                        let currentConnection = globalPeerJSRefData.current.connections[i];
                        currentConnection.send(data);
                    }
                }
            }
            else if (dataJSON["Action"] === "SetVoteData") {
                if (globalPeerJSRefData.current.voteData === undefined) {
                    globalPeerJSRefData.current.voteData = {};
                }

                globalPeerJSRefData.current.voteData[dataJSON.ID] = {
                    "Name": dataJSON.Name,
                    "Value": dataJSON.Value
                };
                setCurrentVoteCount(Object.entries(globalPeerJSRefData.current.voteData).length);
            }
            else if (dataJSON["Action"] === "getVoteDataFromServer") {
                setCurrentSelectedVote("");
                globalPeerJSRefData.current.voteData = dataJSON["Data"];
                setCurrentPageView("view");
            }
            else {
                console.log("GOT UNKNOWN DATA: ", dataJSON);
            }

        } catch(error) {
            console.log("ERROR - something went wrong!");
            console.log(error);
            notifications.show({
                color: "red",
                title: 'ERROR - Something went wrong',
                message: `${JSON.stringify(error)}`,
            });
        }
    }
    function onPeerJSClose() {
        setCurrentPageView("login");
        if (globalPeerJS.current !== null) {
            globalPeerJS.current.destroy();
            globalPeerJS.current = null;
            globalPeerJSRefData.current = {
                connections: [],
                voteData: {},
                issueData: {}
            };
            resetReactVoteData();
        }

        notifications.show({
            title: 'The room was closed',
            message: `The server closed the room`,
        });
        return;
    }

    function peerJSChangeView(desiredView : string) {
        if (globalPeerJS.current === null || globalPeerJS.current === undefined) {
            setCurrentPageView(desiredView);
            return;
        }
        if (isRoomHost.current) {
            for (let i = 0; i < globalPeerJSRefData.current.connections.length; i++) {
                let currentConnection = globalPeerJSRefData.current.connections[i];
                currentConnection.send(JSON.stringify({
                    "Action": "SetCurrentView",
                    "ID": currentPeerId.current,
                    "View": desiredView
                }));
            }
            setCurrentPageView(desiredView)
        }
    }
    function peerJSSetIssueData() {
        if (isRoomHost.current) {
            for (let i = 0; i < globalPeerJSRefData.current.connections.length; i++) {
                let currentConnection = globalPeerJSRefData.current.connections[i];
                currentConnection.send(JSON.stringify({
                    "Action": "SetIssueData",
                    "ID": currentPeerId.current,
                    "Title": currentIssueTitle,
                    "Description": currentIssueDescription
                }));
            }
        }
    }
    function peerJSSendVote(value:string) {
        if (isRoomHost.current === true) {
            if (globalPeerJSRefData.current.voteData === undefined) {
                globalPeerJSRefData.current.voteData = {};
            }

            globalPeerJSRefData.current.voteData[currentPeerId.current] = {
                "Name": inputName,
                "Value": value
            };
            setCurrentVoteCount(Object.entries(globalPeerJSRefData.current.voteData).length);
        }
        else {
            let currentConnection = globalPeerJSRefCon.current;
            currentConnection.send(JSON.stringify({
                "Action": "SetVoteData",
                "ID": currentPeerId.current,
                "Name": inputName,
                "Value": value
            }));
        }
    }
    function peerJSChangeToVoteResults() {
        if (isRoomHost.current) {
            for (let i = 0; i < globalPeerJSRefData.current.connections.length; i++) {
                let currentConnection = globalPeerJSRefData.current.connections[i];
                currentConnection.send(JSON.stringify({
                    "Action": "getVoteDataFromServer",
                    "Data": globalPeerJSRefData.current.voteData
                }));
            }
            setCurrentPageView("view");
        }
    }

    function LoginPageView() {

        function JoinRoomClick() {
            if (inputName === "") {
                alert("Error - please input a name to join!");
                return;
            }
            localStorage.setItem("PointPokerName", inputName || "");

            currentPeerId.current = "ReactPeerPokerClient_" + randomGeneratedId.current;
            isRoomHost.current = false;

            let newJSPeer = new Peer(
                currentPeerId.current
            );
            globalPeerJS.current = newJSPeer;

            setTimeout(() => {
                globalPeerJSRefCon.current = globalPeerJS.current.connect("ReactPeerPokerRoom_" + inputRoom);
                globalPeerJSRefCon.current.on('open', function(id:any) {
                    console.log("CONNECTED TO SERVER...");

                    globalPeerJSRefCon.current.on("data", function(data:any) {
                        onPeerJSData(data)
                    });
                    globalPeerJSRefCon.current.on("close", function() {
                        onPeerJSClose();
                    });
                    globalPeerJSRefCon.current.on("error", function(err : any) {
                        onPeerJSClose();
                    });

                    globalPeerJSRefCon.current.send(JSON.stringify({
                        "Action": "GetCurrentView",
                        "ID": currentPeerId.current
                    }));

                    globalPeerJSRefCon.current.send(JSON.stringify({
                        "Action": "SayHello",
                        "Name": inputName,
                    }));
                });
                setCurrentPageView("wait");
            }, 1000)
        }

        function CreateRoomClick() {
            if (inputName === "") {
                alert("Error - please input a name to host!");
                return;
            }
            localStorage.setItem("PointPokerName", inputName || "");

            window.location.hash = "#" + randomGeneratedId.current;

            {/* @ts-ignore */}
            setInputRoom(randomGeneratedId.current);

            isRoomHost.current = true;
            currentPeerId.current = "ReactPeerPokerRoom_" + randomGeneratedId.current;

            let newJSPeer = new Peer(
                currentPeerId.current
            );
            newJSPeer.on("connection", function(conn) {
                console.log("SERVER GOT NEW CONNECTION: ", conn);
                onPeerJSNewConnection(conn);
            });
            globalPeerJS.current = newJSPeer;
            setCurrentPageView("wait");
        }

        function ResetMemoryClick() {
            localStorage.clear();
            {/* @ts-ignore */}
            setInputName("");
            {/* @ts-ignore */}
            setInputRoom("");
            setColorScheme("auto");
        }

        function getJoinButton() {
            if (inputRoom && inputName) {
                {/* @ts-ignore */}
                if (inputRoom.trim() !== "" && inputName.trim() !== "") {
                    return (<Button variant="filled" color="grape" onClick={JoinRoomClick}>Join Room</Button>);
                }
            }
            return (<Button variant="filled" color="grape" onClick={JoinRoomClick} disabled={true}>Join Room</Button>)
        }
        function getCreateButton() {
            if (inputName) {
                {/* @ts-ignore */}
                if (inputName.trim() !== "") {
                    return (<Button variant="filled" color="grape" onClick={CreateRoomClick}>Create New Room</Button>);
                }
            }
            return (<Button variant="filled" color="grape" disabled={true} onClick={CreateRoomClick}>Create New Room</Button>)
        }

        return (
            <Container>
                <Title ta='center' mt={100} size='72'>
                    <Text inherit variant="gradient" component="span" gradient={{ from: 'rgb(255, 142, 243)', to: 'rgb(142, 255, 255)' }}>React Point Poker</Text>
                </Title>
    
                <SimpleGrid cols={2}>
                    {/* @ts-ignore */}
                    <TextInput label="Name" description="Please enter your name" placeholder='John Doe' value={inputName} onChange={e => setInputName(e.target.value)}></TextInput>
                    {/* @ts-ignore */}
                    <TextInput label="Room ID" description="Please enter the ID of the room you wish to join" placeholder={randomGeneratedId.current} value={inputRoom} onChange={e => setInputRoom(e.target.value)}></TextInput>
                    {getCreateButton()}
                    {getJoinButton()}
                </SimpleGrid>

                <Space h='xl'></Space>
                <Button variant="filled" color="grey" onClick={ResetMemoryClick}>Reset Application Memory</Button>

                <Space h='xl'></Space>
                <Text ta='center'>Set color theme:</Text>
                <ColorSchemeToggle />

                <Space h='xl'></Space>
                <Divider my="md" />
                <Text ta='center' size='8'>Created by <a href="https://twistedtwigleg.itch.io">TwistedTwigleg</a> - <a href="https://github.com/TwistedTwigleg/ReactPointPoker">Source</a></Text>

            </Container>
        ); 
    }

    function ErrorPageView() {
        return (
            <Container>
                <Title ta='center' mt={100} size='72'>
                    <Text inherit variant="gradient" component="span" gradient={{ from: 'red', to: 'orange' }}>ERROR - unknown page!</Text>
                </Title>
            </Container>
        );
    }

    function WaitingPageView() {

        function StartVoteClick() {
            peerJSSetIssueData();
            peerJSChangeView("vote");
        }
        function CloseRoomClick() {
            globalPeerJS.current.destroy();
            globalPeerJS.current = null;
            globalPeerJSRefData.current = {connections: []};
            peerJSChangeView("login");
            resetReactVoteData();
        }

        if (isRoomHost.current === false) {
            return (
                <Container>
                    <Title ta='center' mt={100} size='72'>
                        <Text inherit variant="gradient" component="span" gradient={{ from: 'rgb(255, 142, 243)', to: 'rgb(142, 255, 255)' }}>Please wait...</Text>
                    </Title>
                    <Text ta='center'>The room host is filling in the item to be voted on...</Text>
                </Container>
            );
        }
        else {
            return (
                <Container>
                    <Title ta='center' mt={100} size='72'>
                        <Text inherit variant="gradient" component="span" gradient={{ from: 'rgb(255, 142, 243)', to: 'rgb(142, 255, 255)' }}>Fill in vote details</Text>
                    </Title>

                    <Space h='xl'></Space>
                    <Text ta='center'>Room size: <Text span color='rgb(255, 142, 243)'>{currentConnectionCount}</Text> people are in the room waiting. Share the URL for others to join</Text>
                    <Text ta='center'>Your room ID: <Text span color='rgb(255, 142, 243)'>{inputRoom}</Text></Text>
                    <Space h='xl'></Space>
        
                    <SimpleGrid cols={2}>
                        <TextInput label="Task Name" description="Please enter the name of the task" placeholder='Example: Creating new React Page for Application ABC' value={currentIssueTitle} onChange={e => setCurrentIssueTitle(e.target.value)}></TextInput>
                        <Textarea label="Task Description" description="Please enter the task description" placeholder='Details' value={currentIssueDescription} onChange={e => setCurrentIssueDescription(e.target.value)}></Textarea>
                        <Button variant="filled" color="grape" onClick={StartVoteClick}>Start Vote</Button>
                        <Button variant="filled" color="grey" onClick={CloseRoomClick}>Close Room</Button>
                    </SimpleGrid>
                </Container>
            )
        }
    }

    function VotePageView() {

        function finishVoteClick() {
            peerJSChangeToVoteResults();
        }

        function showVoteButton() {
            if (isRoomHost.current) {
                return (<Button variant="filled" color="grape" onClick={finishVoteClick}>Close Voting</Button>)
            }
            else {
                return (<Text color='rgb(255, 142, 243)'>Please wait for room host to close voting...</Text>)
            }
        }

        function setVoteButton(value : string) {
            setCurrentSelectedVote(value);
            peerJSSendVote(value);
        }
        function makeVoteButton(value : string) {
            if (currentSelectedVote === value) {
                return (<Button variant="filled" color="blue" onClick={() => setVoteButton(value)}>{value}</Button>)
            }
            return (<Button variant="filled" color="grey" onClick={() => setVoteButton(value)}>{value}</Button>)
        }

        function getBottomSection() {
            if (isRoomHost.current === false) {
                return (
                    <SimpleGrid cols={1}>
                        {showVoteButton()}
                    </SimpleGrid>
                );
            }
            return (
                <SimpleGrid cols={2}>
                    <Text>Vote count: {currentVoteCount} out of {currentConnectionCount} have voted</Text>
                    {showVoteButton()}
                </SimpleGrid>
            );
        }

        return (
            <Container>
                <Title ta='center' mt={100} size='72'>
                    <Text inherit variant="gradient" component="span" gradient={{ from: 'rgb(255, 142, 243)', to: 'rgb(142, 255, 255)' }}>Point Vote</Text>
                </Title>

                <Space h='xl'></Space>
                <Text ta='center'><Text color='rgb(255, 142, 243)' span>Title:</Text> <Code block>{currentIssueTitle}</Code></Text>
                <Space h='md'></Space>
                <Text ta='center'><Text color='rgb(255, 142, 243)' span>Description:</Text>: <Code block>{currentIssueDescription}</Code></Text>
                <Space h='xl'></Space>
                <Space h='xl'></Space>

                <Space h='xl'></Space>
                <Text ta='center'>Please select the point value you think matches this item:</Text>
                <Space h='md'></Space>

                <SimpleGrid cols={3}>
                    {makeVoteButton('0')}
                    {makeVoteButton('1')}
                    {makeVoteButton('2')}
                    {makeVoteButton('3')}
                    {makeVoteButton('5')}
                    {makeVoteButton('8')}
                    {makeVoteButton('13')}
                    {makeVoteButton('21')}
                    {makeVoteButton('skip')}
                </SimpleGrid>

                <Space h='xl'></Space>
                {getBottomSection()}

            </Container>
        );
    }

    function ViewVotePage() {

        function OnNewVoteClick() {
            resetReactVoteData();
            peerJSChangeView("wait");
        }

        function OnCloseRoomClick() {
            globalPeerJS.current.destroy();
            globalPeerJS.current = null;
            globalPeerJSRefData.current = {connections: []};
            peerJSChangeView("login");
            resetReactVoteData();
        }

        function GetGroupItem() {
            let returnData = [];
            let voteDataKeyValuePairs = Object.entries(globalPeerJSRefData.current.voteData);
            for (let i = 0; i < voteDataKeyValuePairs.length; i++) {
                let item = voteDataKeyValuePairs[i];
                let voteData : any = item[1];
                returnData.push(
                <Card>
                    <Group justify='center'>
                        <Text>{voteData.Name} Selected</Text>
                        <Text color='rgb(255, 142, 243)'>{voteData.Value}</Text>
                    </Group>
                </Card>
                )
            }
            return returnData;
        }

        function ShowVoteResults() {
            return (
                <SimpleGrid cols={1}>
                    {GetGroupItem()}
                </SimpleGrid>
            )
        }

        function showNewVoteButton() {
            if (isRoomHost.current) {
                return (
                    <SimpleGrid cols={2}>
                        <Button variant="filled" color="grape" onClick={OnNewVoteClick}>Create New Vote</Button>
                        <Button variant="filled" color="grey" onClick={OnCloseRoomClick}>Close Room</Button>
                    </SimpleGrid>
                )
            }
            else {
                return (<Text color='rgb(255, 142, 243)'>Please wait for room host start another vote...</Text>)
            }
        }

        return (
            <Container>
                <Title ta='center' mt={100} size='72'>
                    <Text inherit variant="gradient" component="span" gradient={{ from: 'rgb(255, 142, 243)', to: 'rgb(142, 255, 255)' }}>Vote Results</Text>
                </Title>
                <Space h='xl'></Space>
                <Text ta='center'>The vote results are in! The following votes were cast:</Text>
                <Space h='md'></Space>

                {ShowVoteResults()}

                <Space h='xl'></Space>

                {showNewVoteButton()}

            </Container>
        );
    }

    if (currentPageView === "login") {
        return LoginPageView();
    }
    else if (currentPageView === "wait") {
        return WaitingPageView();
    }
    else if (currentPageView === "vote") {
        return VotePageView();
    }
    else if (currentPageView === "view") {
        return ViewVotePage();
    }
    else {
        console.log("ERROR - current page view is: ", currentPageView);
        return ErrorPageView();
    }
}
