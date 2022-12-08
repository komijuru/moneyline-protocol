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

    async function closedSingleBetFixture(
        commissionPerTicket: BigNumberish,
        aliceChoice: Result, aliceTicketCount: number,
        bobChoice: Result, bobTicketCount: number,
        carolChoice: Result, carolTicketCount: number,
        result: Result,
        injectedAmount: BigNumberish = 0,
    ) {
        const {
            owner,
            treasury,
            operator,
            injector,
            moneylineBets,
            alice,
            bob,
            carol,
            betId,
            pricePerTicket,
            now
        } = await singleBetFixture(commissionPerTicket);

        if (injectedAmount) {
            await moneylineBets.connect(injector).injectBet(betId, {value: injectedAmount});
        }

        await moneylineBets.connect(alice).makeBet(betId, aliceChoice, aliceTicketCount, {value: pricePerTicket.mul(aliceTicketCount)})
        await moneylineBets.connect(bob).makeBet(betId, bobChoice, bobTicketCount, {value: pricePerTicket.mul(bobTicketCount)})
        await moneylineBets.connect(carol).makeBet(betId, carolChoice, carolTicketCount, {value: pricePerTicket.mul(carolTicketCount)})

        const {endsAt} = await moneylineBets.bets(betId);
        await time.increaseTo(endsAt);

        await moneylineBets.connect(operator).closeBets([betId], [result])
        const {prizePerTicket} = await moneylineBets.bets(betId);

        return {
            owner,
            treasury,
            operator,
            injector,
            moneylineBets,
            alice,
            bob,
            carol,
            betId,
            pricePerTicket,
            prizePerTicket,
            now
        };
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

        it('should be reverted with invalid arguments', async () => {
            const {operator, moneylineBets} = await deployFixture();
            const now = await time.latest()
            const day = 86400
            const args = {
                code: "2022_WORLD_CUP",
                teamA: "Republic of Korea",
                teamB: "Portugal",
                startsAt: now,
                endsAt: now + day,
                pricePerTicket: parseEther("1"),
                commissionPerTicket: 0,
            }

            await expect(moneylineBets.connect(operator).openBets([
                {...args, teamA: ""}
            ])).to.be.revertedWith("Invalid request")

            await expect(moneylineBets.connect(operator).openBets([
                {...args, teamB: ""}
            ])).to.be.revertedWith("Invalid request")

            await expect(moneylineBets.connect(operator).openBets([
                {...args, teamA: "Republic of Korea", teamB: "Republic of Korea"}
            ])).to.be.revertedWith("Invalid request")

            await expect(moneylineBets.connect(operator).openBets([
                {...args, endsAt: now - day}
            ])).to.be.revertedWith("Invalid request")

            await expect(moneylineBets.connect(operator).openBets([
                {...args, commissionPerTicket: args.pricePerTicket.add(1)}
            ])).to.be.revertedWith("Invalid request")
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

        it('should be reverted with invalid arguments', async () => {
            const {moneylineBets, alice, pricePerTicket, betId} = await singleBetFixture(parseEther("0.1"));
            const value = pricePerTicket.mul(10);


            await expect(moneylineBets.connect(alice).makeBet(betId, Result.NONE, 10, {value}))
                .to.be.revertedWith("Cannot pick None")

            await expect(moneylineBets.connect(alice).makeBet(betId + 1, Result.WIN, 10, {value}))
                .to.be.revertedWith("Bet not open")

            await expect(moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: 0}))
                .to.be.revertedWith("Wrong amount of ether paid")

            const {endsAt} = await moneylineBets.viewBet(betId, await alice.getAddress());
            await time.increaseTo(endsAt)

            await expect(moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value}))
                .to.be.revertedWith("Betting period is over")
        });
    })

    describe("Inject bet", () => {
        it('should increase injected amount of a bet', async () => {
            const {moneylineBets, injector, betId} = await singleBetFixture(0);

            const {injectedAmount} = await moneylineBets.bets(betId);
            expect(injectedAmount).to.equal(0)

            await moneylineBets.connect(injector).injectBet(betId, {value: parseEther("2")})

            const {injectedAmount: newInjectedAmount} = await moneylineBets.bets(betId);
            expect(newInjectedAmount).to.equal(parseEther("2"))
        });
    })

    describe("Close bets", () => {
        it('should change a bet status', async () => {
            const {moneylineBets, operator, alice, bob, carol, betId} = await singleBetFixture(0);

            await moneylineBets.connect(alice).makeBet(betId, Result.WIN, 10, {value: parseEther("10")})
            await moneylineBets.connect(bob).makeBet(betId, Result.LOSE, 5, {value: parseEther("5")})
            await moneylineBets.connect(carol).makeBet(betId, Result.WIN, 5, {value: parseEther("5")})

            const {endsAt} = await moneylineBets.bets(betId);
            await time.increaseTo(endsAt);

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

            const {endsAt} = await moneylineBets.bets(betId);
            await time.increaseTo(endsAt);

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

                const {endsAt} = await moneylineBets.bets(betId);
                await time.increaseTo(endsAt);

                await moneylineBets.connect(operator).closeBets([betId], [Result.CANCEL])

                const bet = await moneylineBets.bets(betId)

                expect(bet.result).to.equal(Result.CANCEL)
                expect(bet.prizePerTicket).to.equal(0)
                expect(bet.status).to.equal(Status.CLOSED)
            });
        })

        it('should be reverted if bet is not open', async () => {
            const {moneylineBets, operator, betId} = await singleBetFixture(0);

            const {endsAt} = await moneylineBets.bets(betId);
            await time.increaseTo(endsAt);

            await expect(moneylineBets.connect(operator).closeBets([betId + 1], [Result.WIN]))
                .to.be.revertedWith("Not open")
        });

        it('should be reverted if pick is none', async () => {
            const {moneylineBets, operator, betId} = await singleBetFixture(0);

            const {endsAt} = await moneylineBets.bets(betId);
            await time.increaseTo(endsAt);

            await expect(moneylineBets.connect(operator).closeBets([betId], [Result.NONE]))
                .to.be.revertedWith("Cannot pick None")
        });

        it('should be reverted if is not ended', async () => {
            const {moneylineBets, operator, betId} = await singleBetFixture(0);
            await expect(moneylineBets.connect(operator).closeBets([betId], [Result.WIN]))
                .to.be.revertedWith("Invalid period")
        });
    })

    describe("Finalize bet", () => {
        it('should increase winners\' claimable', async () => {
            const {
                moneylineBets,
                operator,
                alice,
                bob,
                carol,
                betId
            } = await closedSingleBetFixture(0,
                Result.WIN, 10,
                Result.LOSE, 5,
                Result.WIN, 5,
                Result.WIN
            );

            await moneylineBets.connect(operator).finalizeBet(betId, 0, 1, false)
            const {claimable: aliceClaimable} = await moneylineBets.viewBet(betId, await alice.getAddress());
            const {claimable: bobClaimable} = await moneylineBets.viewBet(betId, await bob.getAddress());
            const {claimable: carolClaimable} = await moneylineBets.viewBet(betId, await carol.getAddress());
            expect(aliceClaimable).to.equal(parseEther("20").div(15).mul(10));
            expect(bobClaimable).to.equal(0);
            expect(carolClaimable).to.equal(0);

            await moneylineBets.connect(operator).finalizeBet(betId, 1, 1, true)
            const {claimable: newCarolClaimable} = await moneylineBets.viewBet(betId, await carol.getAddress());
            expect(newCarolClaimable).to.equal(parseEther("20").div(15).mul(5));
            const {status} = await moneylineBets.bets(betId);
            expect(status).to.equal(Status.FINALIZED)
        });

        it('should transfer all to treasury if winner not exists', async () => {
            const {
                moneylineBets,
                operator,
                betId,
                pricePerTicket
            } = await closedSingleBetFixture(0,
                Result.WIN, 10,
                Result.WIN, 5,
                Result.WIN, 5,
                Result.LOSE
            );

            await moneylineBets.connect(operator).finalizeBet(betId, 1, 100, true)
            const {treasuryAmount} = await moneylineBets.bets(betId);
            expect(treasuryAmount).to.equal(pricePerTicket.mul(20))
        });

        it('should be reverted if bet is not closed', async () => {
            const {moneylineBets, operator, betId} = await singleBetFixture(0);
            await expect(moneylineBets.connect(operator).finalizeBet(betId, 0, 100, true))
                .to.be.revertedWith("Not closed")
        });

        it('should be reverted if bet is canceled', async () => {
            const {moneylineBets, operator, betId} = await closedSingleBetFixture(0,
                Result.WIN, 10,
                Result.LOSE, 5,
                Result.WIN, 5,
                Result.CANCEL
            );

            await expect(moneylineBets.connect(operator).finalizeBet(betId, 0, 100, true))
                .to.be.revertedWith("Bet canceled")
        });
    })

    describe("Invalidate bet", () => {
        it('should cancel bet and add claimable for each participants', async () => {
            const {
                moneylineBets,
                operator,
                alice,
                bob,
                carol,
                betId,
                pricePerTicket
            } = await closedSingleBetFixture(0,
                Result.WIN, 10,
                Result.LOSE, 5,
                Result.WIN, 5,
                Result.CANCEL
            );

            await moneylineBets.connect(operator).invalidateBet(betId, Result.WIN, 0, 10, false);
            await moneylineBets.connect(operator).invalidateBet(betId, Result.LOSE, 0, 10, false);
            await moneylineBets.connect(operator).invalidateBet(betId, Result.DRAW, 0, 10, true);

            const {claimable: aliceClaimable} = await moneylineBets.viewBet(betId, await alice.getAddress());
            const {claimable: bobClaimable} = await moneylineBets.viewBet(betId, await bob.getAddress());
            const {claimable: carolClaimable} = await moneylineBets.viewBet(betId, await carol.getAddress());

            expect(aliceClaimable).to.equal(pricePerTicket.mul(10))
            expect(bobClaimable).to.equal(pricePerTicket.mul(5))
            expect(carolClaimable).to.equal(pricePerTicket.mul(5))
        });

        it('should be reverted if bet is not canceled', async () => {
            const {
                moneylineBets,
                operator,
                betId,
            } = await closedSingleBetFixture(0,
                Result.WIN, 10,
                Result.LOSE, 5,
                Result.WIN, 5,
                Result.WIN
            );

            await expect(moneylineBets.connect(operator).invalidateBet(betId, Result.WIN, 0, 10, true))
                .to.be.revertedWith("Already finalized or not canceled")
        });
    })

    describe("Claim bet", () => {
        it('should increase ether balance of msg.sender', async () => {
            const {
                moneylineBets,
                operator,
                alice,
                carol,
                betId,
                prizePerTicket
            } = await closedSingleBetFixture(0,
                Result.WIN, 10,
                Result.LOSE, 5,
                Result.WIN, 5,
                Result.WIN
            );

            await moneylineBets.connect(operator).finalizeBet(betId, 0, 100, true)
            await expect(moneylineBets.connect(alice).claimBet(betId))
                .to.changeEtherBalances([moneylineBets, alice], [prizePerTicket.mul(-10), prizePerTicket.mul(10)])
            await expect(moneylineBets.connect(carol).claimBet(betId))
                .to.changeEtherBalances([moneylineBets, carol], [prizePerTicket.mul(-5), prizePerTicket.mul(5)])
        });

        describe("with injected exists", () => {
            it('should transfer injected amount divided by winners', async () => {
                const injectedAmount = parseEther("2");
                const commissionPerTicket = parseEther("0.1");
                const {
                    pricePerTicket,
                    prizePerTicket
                } = await closedSingleBetFixture(commissionPerTicket,
                    Result.WIN, 10,
                    Result.LOSE, 5,
                    Result.WIN, 5,
                    Result.WIN,
                    injectedAmount
                );

                expect(prizePerTicket).to.equal(pricePerTicket.sub(commissionPerTicket).mul(20).add(injectedAmount).div(15))
            });
        })
    })

    describe("Settle treasury", () => {
        const commissionPerTicket = parseEther("0.1");

        it('should transfer commission fee of a bet', async () => {
            const {
                moneylineBets,
                operator,
                treasury,
                betId,
            } = await closedSingleBetFixture(commissionPerTicket,
                Result.WIN, 10,
                Result.LOSE, 5,
                Result.WIN, 5,
                Result.WIN
            );

            await moneylineBets.connect(operator).finalizeBet(betId, 0, 100, true)

            await expect(moneylineBets.connect(operator).settleTreasury(betId))
                .to.changeEtherBalances([moneylineBets, treasury], [commissionPerTicket.mul(-20), commissionPerTicket.mul(20)])
        });

        describe("with injected and canceled bet", () => {
            const injectedAmount = parseEther("2")
            it('should transfer only injected amount', async () => {
                const commissionPerTicket = parseEther("0.1");
                const {
                    moneylineBets,
                    operator,
                    treasury,
                    betId,
                } = await closedSingleBetFixture(commissionPerTicket,
                    Result.WIN, 10,
                    Result.LOSE, 5,
                    Result.WIN, 5,
                    Result.CANCEL,
                    injectedAmount
                );

                await moneylineBets.connect(operator).invalidateBet(betId, Result.WIN, 0, 100, false)
                await moneylineBets.connect(operator).invalidateBet(betId, Result.DRAW, 0, 100, false)
                await moneylineBets.connect(operator).invalidateBet(betId, Result.LOSE, 0, 100, true)

                await expect(moneylineBets.connect(operator).settleTreasury(betId))
                    .to.changeEtherBalances(
                        [moneylineBets, treasury],
                        [injectedAmount.mul(-1), injectedAmount]
                    )
            });
        })
    })
})