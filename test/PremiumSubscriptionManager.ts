import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('PremiumAccessManager', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    const [owner, ...otherAccounts] = await ethers.getSigners();

    const BattlePass = await ethers.getContractFactory('BattlePass');
    const battlePass = await BattlePass.deploy();

    return { battlePass, owner, otherAccounts };
  }

  describe('grantPremium', function () {
    it('Should only be usable by the owner', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.connect(otherAccounts[0]).grantPremium(otherAccounts[0].address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Should set the premium status of the address to true', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.grantPremium(otherAccounts[0].address))
        .to.emit(battlePass, 'GrantPremiumAccess')
        .withArgs(otherAccounts[0].address);

      const hasPremium = await battlePass.hasPremium(otherAccounts[0].address);
      expect(hasPremium).to.be.true;
    });
  });

  describe('setPremiumPrice', function () {
    it('Should only be usable by a manager address', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.connect(otherAccounts[0]).setPremiumPrice('1000000000000000000')).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Should set the premium price', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      await expect(battlePass.setPremiumPrice('1000000000000000000'))
        .to.emit(battlePass, 'SetPremiumPrice')
        .withArgs('1000000000000000000');

      const premiumPrice = await battlePass.premiumPrice();
      expect(premiumPrice).to.equal('1000000000000000000');
    });
  });

  describe('buyPremium', function () {
    it('Should set the premium status of the address to true', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await battlePass.setPremiumPrice('10000000000');
      await expect(battlePass.connect(otherAccounts[0]).buyPremium({ value: '10000000000' }))
        .to.emit(battlePass, 'GrantPremiumAccess')
        .withArgs(otherAccounts[0].address);

      const hasPremium = await battlePass.hasPremium(otherAccounts[0].address);
      expect(hasPremium).to.be.true;
    });
    it('Should fail if the price of premium is 0', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.connect(otherAccounts[0]).buyPremium()).to.be.revertedWith(
        'PremiumAccessManager: premium price cannot be 0',
      );
    });
    it('Should fail if the address already has premium', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await battlePass.setPremiumPrice('10000000000');
      await battlePass.connect(otherAccounts[0]).buyPremium({ value: '10000000000' });
      await expect(battlePass.connect(otherAccounts[0]).buyPremium({ value: '10000000000' })).to.be.revertedWith(
        'PremiumAccessManager: caller already has premium',
      );
    });
    it('Should fail if the value sent is too low', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await battlePass.setPremiumPrice('10000000000');
      await expect(battlePass.connect(otherAccounts[0]).buyPremium({ value: '1' })).to.be.revertedWith(
        'PremiumAccessManager: wrong value sent',
      );
    });
    it('Should fail if the value sent is too high', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await battlePass.setPremiumPrice('10000000000');
      await expect(battlePass.connect(otherAccounts[0]).buyPremium({ value: '100000000000' })).to.be.revertedWith(
        'PremiumAccessManager: wrong value sent',
      );
    });
  });
});
