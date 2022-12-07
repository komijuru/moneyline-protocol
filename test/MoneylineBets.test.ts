import {ethers} from "hardhat";
import {expect} from "chai";
import {MoneylineBets__factory} from "@typechain-types/factories/contracts/MoneylineBets";
import {MoneylineBets} from "@typechain-types/contracts/MoneylineBets";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import {keccak256, parseEther, toUtf8Bytes} from "ethers/lib/utils";
import {Result, Status} from "@scripts/MoneylineBets";
import {BigNumberish} from "ethers";

describe("MoneylineBets", () => {
    async function deployFixture() {
        const [owner, treasury, operator, injector, alice, bob, carol] = await ethers.getSigners();

        const contractFactory: MoneylineBets__factory = await ethers.getContractFactory('MoneylineBets');
        const moneylineBets: MoneylineBets = await contractFactory.connect(owner).deploy(await treasury.getAddress());
        await moneylineBets.grantRole(await moneylineBets.OPERATOR_ROLE(), await operator.getAddress())
        await moneylineBets.grantRole(await moneylineBets.INJECTOR_ROLE(), await injector.getAddress())

        return {owner, treasury, operator, injector, moneylineBets, alice, bob, carol};
    }

    async function singleBetFixture(commissionPerTicket: BigNumberish) {
        const {owner, treasury, operator, injector, moneylineBets, alice, bob, carol} = await deployFixture()

        const now = await time.latest()
        const day = 86400

        const pricePerTicket = parseEther("1");
        await moneylineBets.connect(operator).openBets([
            {
                code: "2022_WORLD_CUP",
                teamA: "Republic of Korea",
                teamB: "Portugal",
                startsAt: now,
                endsAt: now + day,
                pricePerTicket: pricePerTicket,
                commissionPerTicket: commissionPerTicket,
            },
        ])

        return {owner, treasury, operator, injector, moneylineBets, alice, bob, carol, betId: 1, pricePerTicket, now};
    }

    describe("Deployment", () => {
        it("should set treasury address", async () => {
            const {treasury, moneylineBets} = await deployFixture();
            expect(await moneylineBets.treasury()).to.equal(await treasury.getAddress());
        })
    })

    describe("Open bets", () => {
        it('should open new bets', async () => {
            const {operator, moneylineBets} = await deployFixture();
            const now = await time.latest()
            const day = 86400
            await moneylineBets.connect(operator).openBets([
                {
                    code: "2022_WORLD_CUP",
                    teamA: "Republic of Korea",
                    teamB: "Portugal",
                    startsAt: now,
                    endsAt: now + day,
                    pricePerTicket: parseEther("1"),
                    commissionPerTicket: 0,
                },
                {
                    code: "2022_WORLD_CUP",
                    teamA: "Republic of Korea",
                    teamB: "Brazil",
                    startsAt: now,
                    endsAt: now + 2 * day,
                    pricePerTicket: parseEther("1"),
                    commissionPerTicket: parseEther("0.1"),
                }
            ])
            const bet = await moneylineBets.bets(1);
            expect(bet.code).to.equal(keccak256(toUtf8Bytes("2022_WORLD_CUP")));
            expect(bet.id).to.equal(1);
            expect(bet.teamA).to.equal("Republic of Korea");
            expect(bet.teamB).to.equal("Portugal");
            expect(bet.startsAt).to.equal(now);
            expect(bet.endsAt).to.equal(now + day);
            expect(bet.pricePerTicket).to.equal(parseEther("1"));
            expect(bet.prizePerTicket).to.equal(0);
            expect(bet.commissionPerTicket).to.equal(0);
            expect(bet.injectedAmount).to.equal(0);
            expect(bet.result).to.equal(Result.NONE);
            expect(bet.status).to.equal(Status.OPEN);

            const latestBetId = await moneylineBets.latestBetId()
            expect(latestBetId).to.equal(2)
        });

        it('should emit OpenBet event', async () => {
            const {operator, moneylineBets} = await deployFixture();
            const now = await time.latest()
            const day = 86400
            await expect(moneylineBets.connect(operator).openBets([
                {
                    code: "2022_WORLD_CUP",
                    teamA: "Republic of Korea",
                    teamB: "Portugal",
                    startsAt: now,
                    endsAt: now + day,
                    pricePerTicket: parseEther("1"),
                    commissionPerTicket: 0,
                }
            ]))
                .to.emit(moneylineBets, "OpenBet")
                .withArgs(1, now, now + day, parseEther("1"))
        });

        it('TODO: should be reverted with invalid arguments', async () => {
        });
    })

    describe("Make bet", () => {
        it('should change ether balances', async () => {
            const {moneylineBets, alice, pricePerTicket, betId} = await singleBetFixture(0);

            await expect(moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: pricePerTicket.mul(10)}))
                .to.changeEtherBalances(
                    [moneylineBets, alice],
                    [pricePerTicket.mul(10), pricePerTicket.mul(-10)])
        });

        it('should change a bet status', async () => {
            const {moneylineBets, alice, bob, pricePerTicket, betId} = await singleBetFixture(0);

            await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: pricePerTicket.mul(10)})
            await moneylineBets.connect(bob).makeBet(betId, Result.WIN, 5, {value: pricePerTicket.mul(5)})

            const bet = await moneylineBets.viewBet(betId, await alice.getAddress());

            expect(bet.winChoices[0]).to.equal(await alice.getAddress());
            expect(bet.winChoices[1]).to.equal(await bob.getAddress());
            expect(bet.winTicketCounts[0]).to.equal(10);
            expect(bet.winTicketCounts[1]).to.equal(5);
            expect(bet.winTotalTicketCount).to.equal(15);
            expect(bet.winTotalSize).to.equal(parseEther("15"));
        });

        it('should emit MakeBet event', async () => {
            const {moneylineBets, alice, pricePerTicket, betId} = await singleBetFixture(0);

            await expect(moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: pricePerTicket.mul(10)}))
                .to.emit(moneylineBets, "MakeBet")
                .withArgs(await alice.getAddress(), Result.WIN, 10)
        });

        describe("with commission existing", () => {
            it('should send ether to treasury', async () => {
                const {moneylineBets, alice, treasury, betId} = await singleBetFixture(parseEther("0.1"));

                await expect(moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: parseEther("10")}))
                    .to.changeEtherBalances([moneylineBets, alice], [parseEther("10"), parseEther("-10")])
            });

            it('should decrease total size', async () => {
                const {moneylineBets, alice, bob, betId} = await singleBetFixture(parseEther("0.1"));

                await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: parseEther("10")})
                await moneylineBets.connect(bob).makeBet(betId, Result.WIN, 5, {value: parseEther("5")})

                const bet = await moneylineBets.viewBet(betId, await alice.getAddress());
                expect(bet.winTotalSize).to.equal(parseEther("13.5"));
            });

            it('should increase treasury amount', async () => {
                const {moneylineBets, alice, pricePerTicket, betId} = await singleBetFixture(parseEther("0.1"));

                const bet = await moneylineBets.bets(betId);
                expect(bet.treasuryAmount).to.equal(0);
                await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: pricePerTicket.mul(10)});
                const updatedBet = await moneylineBets.bets(betId);
                expect(updatedBet.treasuryAmount).to.equal(parseEther("0.1").mul(10));
            });
        })

        it('TODO: should be reverted with invalid arguments', async () => {
        });
    })

    describe("Close bets", () => {
        it('should change a bet status', async () => {
            const {moneylineBets, operator, alice, bob, carol, betId} = await singleBetFixture(0);

            await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: parseEther("10")})
            await moneylineBets.connect(bob).makeBet(betId, Result.LOSE, 5, {value: parseEther("5")})
            await moneylineBets.connect(carol).makeBet(betId, Result.WIN, 5, {value: parseEther("5")})

            await moneylineBets.connect(operator).closeBets([betId], [Result.WIN])

            const bet = await moneylineBets.bets(betId);

            expect(bet.result).to.equal(Result.WIN)
            expect(bet.prizePerTicket).to.equal(parseEther("20").div(15))
            expect(bet.status).to.equal(Status.CLOSED)
        });

        it('should emit CloseBet event', async () => {
            const {moneylineBets, alice, bob, carol, operator, betId} = await singleBetFixture(0);

            await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: parseEther("10")})
            await moneylineBets.connect(bob).makeBet(betId, Result.LOSE, 5, {value: parseEther("5")})
            await moneylineBets.connect(carol).makeBet(betId, Result.WIN, 5, {value: parseEther("5")})

            await expect(moneylineBets.connect(operator).closeBets([betId], [Result.WIN]))
                .to.emit(moneylineBets, "CloseBet")
                .withArgs(betId, Result.WIN, parseEther("20").div(15))
        });

        describe("with canceled result", () => {
            it('should not change prize per ticket', async () => {
                const {moneylineBets, operator, alice, bob, carol, betId} = await singleBetFixture(0);

                await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: parseEther("10")})
                await moneylineBets.connect(bob).makeBet(betId, Result.LOSE, 5, {value: parseEther("5")})
                await moneylineBets.connect(carol).makeBet(betId, Result.WIN, 5, {value: parseEther("5")})

                await moneylineBets.connect(operator).closeBets([betId], [Result.CANCEL])

                const bet = await moneylineBets.bets(betId)

                expect(bet.result).to.equal(Result.CANCEL)
                expect(bet.prizePerTicket).to.equal(0)
                expect(bet.status).to.equal(Status.CLOSED)
            });
        })

        it('TODO: should be reverted if bet is not open', async () => {

        });
    })

    describe("Finalize bet", () => {
        it('should increase winners\' claimable', async () => {
            const {moneylineBets, operator, alice, bob, carol, betId} = await singleBetFixture(0);

            await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: parseEther("10")})
            await moneylineBets.connect(bob).makeBet(betId, Result.LOSE, 5, {value: parseEther("5")})
            await moneylineBets.connect(carol).makeBet(betId, Result.WIN, 5, {value: parseEther("5")})
            await moneylineBets.connect(operator).closeBets([betId], [Result.WIN])

            await moneylineBets.connect(operator).finalizeBet(betId, 0, 1, false)
            const {claimable: aliceClaimable} = await moneylineBets.viewBet(betId, await alice.getAddress());
            const {claimable: carolClaimable} = await moneylineBets.viewBet(betId, await carol.getAddress());
            expect(aliceClaimable).to.equal(parseEther("20").div(15).mul(10));
            expect(carolClaimable).to.equal(0);

            await moneylineBets.connect(operator).finalizeBet(betId, 1, 1, true)
            const {claimable: newCarolClaimable} = await moneylineBets.viewBet(betId, await carol.getAddress());
            expect(newCarolClaimable).to.equal(parseEther("20").div(15).mul(5));
            const {status} = await moneylineBets.bets(betId);
            expect(status).to.equal(Status.FINALIZED)
        });

        it('TODO: should be reverted if bet is not closed', async () => {

        });
    })
})