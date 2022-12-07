// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IMoneylineBets.sol";

contract MoneylineBets is IMoneylineBets, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant INJECTOR_ROLE = keccak256("INJECTOR_ROLE");

    address payable public immutable treasury;

    uint256 public latestBetId;
    mapping(uint256 => Bet) public bets;

    event ClaimBet(address indexed from, uint256 indexed amount);
    event MakeBet(address indexed from, Result indexed choice, uint256 indexed ticketCount);
    event CommissionPayment(address indexed from, uint256 indexed commissionAmount);
    event OpenBet(uint256 indexed id, uint256 indexed startsAt, uint256 indexed endsAt, uint256 pricePerTicket);
    event CloseBet(uint256 indexed id, Result indexed result, uint256 indexed prizePerTicket);
    event FinalizeBet(uint256 indexed id, uint256 indexed fromIdx, uint256 indexed toIdx);
    event InvalidateBet(uint256 indexed id, Result choice, uint256 indexed fromIdx, uint256 indexed toIdx);
    event InjectBet(uint256 indexed id, uint256 indexed amount);

    constructor(address payable _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        treasury = _treasury;
    }

    function makeBet(uint256 id, Result choice, uint256 ticketCount) external payable {
        Bet storage bet = bets[id];
        require(choice != Result.NONE, "Cannot pick None");
        require(bet.status == Status.OPEN, "Not open");
        require(bet.startsAt <= block.timestamp && block.timestamp <= bet.endsAt, "Betting period is over");
        require(ticketCount * bet.pricePerTicket == msg.value, "Wrong amount of ether paid");

        bet.choices[choice].push(msg.sender);
        bet.ticketCounts[choice].push(ticketCount);
        bet.totalTicketCount[choice] += ticketCount;

        if (bet.commissionPerTicket > 0) {
            (bool sent,) = treasury.call{value : ticketCount * bet.commissionPerTicket}("");
            require(sent, "Failed ether transfer");
            emit CommissionPayment(msg.sender, ticketCount * bet.commissionPerTicket);
        }
        emit MakeBet(msg.sender, choice, ticketCount);
    }

    function claimBet(uint256 id) external {
        Bet storage bet = bets[id];
        require(bet.status == Status.FINALIZED, "Not finalized");
        require(bet.claimable[msg.sender] > 0, "Nothing to claim");
        uint256 amount = bet.claimable[msg.sender];
        (bool sent,) = payable(msg.sender).call{value : amount}("");
        require(sent, "Failed ether transfer");
        bet.claimable[msg.sender] = 0;
        emit ClaimBet(msg.sender, amount);
    }

    // @dev only operator
    function openBets(
        OpenBetRequest[] calldata requests
    ) external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < requests.length; i++) {
            OpenBetRequest memory request = requests[i];
            uint256 id = ++latestBetId;
            Bet storage bet = bets[id];
            require(
                keccak256(abi.encodePacked(request.teamA)) != ""
                && keccak256(abi.encodePacked(request.teamB)) != ""
                && keccak256(abi.encodePacked(request.teamA)) != keccak256(abi.encodePacked(request.teamB))
                && request.startsAt < request.endsAt
                && request.pricePerTicket > request.commissionPerTicket,
                "Invalid request"
            );

            bet.code = keccak256(abi.encodePacked(request.code));
            bet.id = id;
            bet.teamA = request.teamA;
            bet.teamB = request.teamB;
            bet.startsAt = request.startsAt;
            bet.endsAt = request.endsAt;
            bet.pricePerTicket = request.pricePerTicket;
            bet.commissionPerTicket = request.commissionPerTicket;
            bet.prizePerTicket = 0;
            bet.result = Result.NONE;
            bet.status = Status.OPEN;
            emit OpenBet(id, request.startsAt, request.endsAt, request.pricePerTicket);
        }
    }

    // @dev only operator
    function closeBets(
        uint256[] calldata ids,
        Result[] calldata results
    ) external onlyRole(OPERATOR_ROLE) {
        require(ids.length == results.length, "Invalid input length");
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            Result result = results[i];
            Bet storage bet = bets[id];
            require(bet.status == Status.OPEN, "Not open");
            require(bet.result == Result.NONE, "Cannot pick None");

            bet.result = result;
            uint256 totalPrize = bet.injectedAmount
            + bet.totalTicketCount[Result.WIN] * (bet.pricePerTicket - bet.commissionPerTicket)
            + bet.totalTicketCount[Result.LOSE] * (bet.pricePerTicket - bet.commissionPerTicket)
            + bet.totalTicketCount[Result.DRAW] * (bet.pricePerTicket - bet.commissionPerTicket);

            if (bet.choices[bet.result].length != 0 && result != Result.CANCEL) {
                bet.prizePerTicket = totalPrize / bet.totalTicketCount[bet.result];
            }
            bet.status = Status.CLOSED;

            emit CloseBet(id, result, bet.prizePerTicket);
        }
    }

    // @dev only operator
    function invalidateBet(uint256 id, Result choice, uint256 fromIdx, uint256 limit, bool isLast) external onlyRole(OPERATOR_ROLE) {
        Bet storage bet = bets[id];
        require(bet.status == Status.CLOSED && bet.result == Result.CANCEL, "Already finalized or not canceled");

        uint256 toIdx = fromIdx + limit;
        if (toIdx > bet.choices[choice].length) {
            toIdx = bet.choices[choice].length;
        }
        for (uint256 i = fromIdx; i < toIdx; i++) {
            bet.claimable[bet.choices[choice][i]] += bet.pricePerTicket * bet.ticketCounts[choice][i];
        }

        if (isLast) {
            bet.status = Status.FINALIZED;
        }

        emit InvalidateBet(id, choice, fromIdx, toIdx);
    }

    // @dev only operator
    function finalizeBet(uint256 id, uint256 fromIdx, uint256 limit, bool isLast) external onlyRole(OPERATOR_ROLE) {
        Bet storage bet = bets[id];
        require(bet.status == Status.CLOSED, "Not closed");

        uint256 toIdx = fromIdx + limit;
        if (toIdx > bet.choices[bet.result].length) {
            toIdx = bet.choices[bet.result].length;
        }
        for (uint256 i = fromIdx; i < toIdx; i++) {
            bet.claimable[bet.choices[bet.result][i]] += bet.ticketCounts[bet.result][i] * bet.prizePerTicket;
        }

        if (isLast) {
            bet.status = Status.FINALIZED;
        }

        emit FinalizeBet(id, fromIdx, toIdx);
    }

    // @dev only injector
    function injectBet(uint256 id) external payable onlyRole(INJECTOR_ROLE) {
        Bet storage bet = bets[id];
        require(bet.status == Status.OPEN || bet.status == Status.CLOSED, "Not open or closed");

        bet.injectedAmount = msg.value;

        emit InjectBet(id, msg.value);
    }

    function viewBet(uint256 id, address viewer) public view returns (BetView memory) {
        Bet storage bet = bets[id];
        return BetView({
        code : bet.code,
        id : bet.id,
        teamA : bet.teamA,
        teamB : bet.teamB,
        startsAt : bet.startsAt,
        endsAt : bet.endsAt,
        pricePerTicket : bet.pricePerTicket,
        prizePerTicket : bet.prizePerTicket,
        commissionPerTicket : bet.commissionPerTicket,
        injectedAmount : bet.injectedAmount,
        result : bet.result,
        status : bet.status,
        winChoices : bet.choices[Result.WIN],
        loseChoices : bet.choices[Result.LOSE],
        drawChoices : bet.choices[Result.DRAW],
        winTicketCounts : bet.ticketCounts[Result.WIN],
        loseTicketCounts : bet.ticketCounts[Result.LOSE],
        drawTicketCounts : bet.ticketCounts[Result.DRAW],
        winTotalTicketCount : bet.totalTicketCount[Result.WIN],
        drawTotalTicketCount : bet.totalTicketCount[Result.LOSE],
        loseTotalTicketCount : bet.totalTicketCount[Result.DRAW],
        winTotalSize : bet.totalTicketCount[Result.WIN] * (bet.pricePerTicket - bet.commissionPerTicket),
        loseTotalSize : bet.totalTicketCount[Result.LOSE] * (bet.pricePerTicket - bet.commissionPerTicket),
        drawTotalSize : bet.totalTicketCount[Result.DRAW] * (bet.pricePerTicket - bet.commissionPerTicket),
        claimable : bet.claimable[viewer]
        });
    }

    function viewBets(uint256 fromId, address viewer) external view returns (BetView[100] memory) {
        BetView[100] memory betViews;
        for (uint256 i = 0; i < 100; i++) {
            betViews[i] = viewBet(fromId + i, viewer);
        }
        return betViews;
    }
}
