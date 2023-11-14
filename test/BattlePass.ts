import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('BattlePass', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    const [owner, ...otherAccounts] = await ethers.getSigners();

    const BattlePass = await ethers.getContractFactory('BattlePass');
    const battlePass = await BattlePass.deploy();

    const ERC20 = await ethers.getContractFactory('ERC20TokenMock');
    const erc20 = await ERC20.deploy('test', 'TEST', owner.address, ethers.utils.parseEther('10000'));

    const ERC1155 = await ethers.getContractFactory('ERC1155TokenMock');
    const erc1155 = await ERC1155.deploy('');
    await erc1155.mintBatch(owner.address, [0, 1, 2], [10000, 10000, 10000], '0x');

    const erc20ItemType = 0;
    const erc1155ItemType = 1;

    await erc20.approve(battlePass.address, ethers.utils.parseEther('100'));
    await erc1155.setApprovalForAll(battlePass.address, true);

    return { battlePass, erc20, erc1155, owner, otherAccounts, erc20ItemType, erc1155ItemType };
  }

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      const { battlePass, owner } = await loadFixture(deployFixture);

      expect(await battlePass.owner()).to.equal(owner.address);
    });
    it(`All addresses shouldn't be managers except the owner`, async function () {
      const { battlePass, owner, otherAccounts } = await loadFixture(deployFixture);

      for (let i = 0; i < otherAccounts.length; i++) {
        const account = otherAccounts[i];
        const isManager = await battlePass.isManager(account.address);
        expect(isManager).to.be.false;
      }

      const isManager = await battlePass.isManager(owner.address);
      expect(isManager).to.be.true;
    });
    it('All addresses should have 0 points', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      for (let i = 0; i < otherAccounts.length; i++) {
        const account = otherAccounts[i];
        const accountPoints = await battlePass.balanceOf(account.address);
        expect(accountPoints.toString()).to.equal('0');
      }
    });
  });

  describe('setManagerStatus', function () {
    it('Should only be usable by the owner', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(
        battlePass.connect(otherAccounts[0]).setManagerStatus(otherAccounts[0].address, true),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Should add the address to the list of managers', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);
      await expect(battlePass.setManagerStatus(otherAccounts[0].address, true))
        .to.emit(battlePass, 'SetManagerStatus')
        .withArgs(otherAccounts[0].address, true);

      const isManager = await battlePass.isManager(otherAccounts[0].address);
      expect(isManager).to.be.true;
    });
    it('Should remove the address from the list of managers', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);
      // Set the address to true first
      await battlePass.setManagerStatus(otherAccounts[0].address, true);

      await expect(battlePass.setManagerStatus(otherAccounts[0].address, false))
        .to.emit(battlePass, 'SetManagerStatus')
        .withArgs(otherAccounts[0].address, false);

      const isManager = await battlePass.isManager(otherAccounts[0].address);
      expect(isManager).to.be.false;
    });
  });

  describe('grantPoints', function () {
    it('Should only be usable by a manager address', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.connect(otherAccounts[0]).grantPoints('1', otherAccounts[0].address)).to.be.revertedWith(
        'BattlePass: caller is not a manager',
      );
    });
    it('Should add N points to the balance of an address', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.grantPoints('1', otherAccounts[0].address))
        .to.emit(battlePass, 'GrantPoints')
        .withArgs('1', otherAccounts[0].address);

      // Make sure points are added up and not just set
      await battlePass.grantPoints('1', otherAccounts[0].address);

      const accountPoints = await battlePass.balanceOf(otherAccounts[0].address);
      expect(accountPoints.toString()).to.equal('2');
    });
  });

  describe('createStep', function () {
    it('Should only be usable by the owner', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.connect(otherAccounts[0]).createStep('100', '50', false)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Should create a step', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      const pointsRequired = 100;
      const claimsAmount = 50;
      const isPremiumRequired = false;
      await expect(battlePass.createStep(pointsRequired, claimsAmount, isPremiumRequired))
        .to.emit(battlePass, 'CreateStep')
        .withArgs('0', pointsRequired, claimsAmount, isPremiumRequired);

      const stepsAmount = await battlePass.stepsAmount();
      expect(stepsAmount).to.equal('1');

      const step = await battlePass.getStep(0);
      expect(step.pointsRequired).to.equal(pointsRequired);
      expect(step.isPremiumRequired).to.equal(isPremiumRequired);
      expect(step.claimsAmount).to.equal(claimsAmount);
      expect(step.itemsAmount).to.equal(0);
    });
  });

  describe('addItemToStep', function () {
    it('Should only be usable by the owner', async function () {
      const { battlePass, erc20, erc20ItemType, otherAccounts } = await loadFixture(deployFixture);

      await expect(
        battlePass.connect(otherAccounts[0]).addItemToStep(0, erc20ItemType, erc20.address, '100', 5),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Should add an ERC20 item to the step', async function () {
      const { battlePass, erc20, erc20ItemType } = await loadFixture(deployFixture);

      const amount = ethers.utils.parseEther('1');
      await battlePass.createStep('100', '50', false);
      await battlePass.addItemToStep(0, erc20ItemType, erc20.address, '0', amount);

      const item = await battlePass.getItemOfStep(0, 0);
      expect(item.itemType).to.equal(erc20ItemType);
      expect(item.contractAddress).to.equal(erc20.address);
      expect(item.tokenId).to.equal('0');
      expect(item.amount).to.equal(amount);
    });
    it('Should add an ERC1155 item to the step', async function () {
      const { battlePass, erc1155, erc1155ItemType } = await loadFixture(deployFixture);

      const amount = '5';
      const tokenId = '1';
      await battlePass.createStep('100', '50', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, tokenId, amount);

      const item = await battlePass.getItemOfStep(0, 0);
      expect(item.itemType).to.equal(erc1155ItemType);
      expect(item.contractAddress).to.equal(erc1155.address);
      expect(item.tokenId).to.equal(tokenId);
      expect(item.amount).to.equal(amount);
    });
  });

  describe('getStep', function () {
    it('Should fail if the step does not exist', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      await expect(battlePass.getStep(0)).to.be.revertedWith('BattlePass: step does not exist');
    });
    it('Should return the step at the provided index', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      const pointsRequired = 100;
      const isPremiumRequired = false;
      const claimsAmount = 50;
      await battlePass.createStep(pointsRequired, claimsAmount, isPremiumRequired);

      const step = await battlePass.getStep(0);
      expect(step.pointsRequired).to.equal(pointsRequired);
      expect(step.isPremiumRequired).to.equal(isPremiumRequired);
      expect(step.claimsAmount).to.equal(claimsAmount);
      expect(step.itemsAmount).to.equal(0);
    });
  });

  describe('getItemOfStep', function () {
    it('Should fail if the step does not exist', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      await expect(battlePass.getItemOfStep(0, 0)).to.be.revertedWith('BattlePass: step does not exist');
    });
    it('Should fail if the item does not exist', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      await battlePass.createStep('100', '50', false);
      await expect(battlePass.getItemOfStep(0, 0)).to.be.revertedWith('BattlePass: item in step does not exist');
    });
  });

  describe('enableStep', function () {
    it('Should only be usable by the owner', async function () {
      const { battlePass, otherAccounts } = await loadFixture(deployFixture);

      await expect(battlePass.connect(otherAccounts[0]).enableStep(0)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Should fail if the step does not exist', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      await expect(battlePass.enableStep(0)).to.be.revertedWith('BattlePass: step does not exist');
    });
    it('Should fail if the step was already activated', async function () {
      const { battlePass, erc1155, erc1155ItemType } = await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.enableStep(0);

      await expect(battlePass.enableStep(0)).to.be.revertedWith('BattlePass: step is already enabled');
    });
    it('Should activate the step if the caller has all of the assets', async function () {
      const { battlePass, erc1155, erc20, erc1155ItemType, erc20ItemType } = await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 1, 2);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 2, 1);
      await battlePass.addItemToStep(0, erc20ItemType, erc20.address, '0', ethers.utils.parseEther('1'));
      await expect(battlePass.enableStep(0)).to.emit(battlePass, 'EnableStep').withArgs('0');

      const erc1155Balances = await erc1155.balanceOfBatch(
        [battlePass.address, battlePass.address, battlePass.address],
        [0, 1, 2],
      );

      expect(erc1155Balances[0]).to.equal('50');
      expect(erc1155Balances[1]).to.equal('20');
      expect(erc1155Balances[2]).to.equal('10');

      const ercBalance = await erc20.balanceOf(battlePass.address);
      expect(ercBalance).to.equal(ethers.utils.parseEther('10'));

      const step = await battlePass.getStep(0);
      expect(step.isClaimable).to.be.true;
    });
  });

  describe('claimStep', function () {
    it('Should fail if the step does not exist', async function () {
      const { battlePass, owner } = await loadFixture(deployFixture);

      await expect(battlePass.claimStep(owner.address, 0)).to.be.revertedWith('BattlePass: step does not exist');
    });
    it('Should fail if the step is not claimable', async function () {
      const { battlePass, owner, erc1155ItemType, erc1155 } = await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);

      await expect(battlePass.claimStep(owner.address, 0)).to.be.revertedWith('BattlePass: step is not claimable');
    });
    it('Should fail if the caller does not have enough points', async function () {
      const { battlePass, owner, erc1155ItemType, erc1155 } = await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.enableStep(0);

      await expect(battlePass.claimStep(owner.address, 0)).to.be.revertedWith(
        'BattlePass: caller does not have enough points',
      );
    });
    it('Should fail if the step has reached its maximum amount of claims', async function () {
      const { battlePass, owner, erc1155ItemType, erc1155, otherAccounts } = await loadFixture(deployFixture);

      await battlePass.createStep('50', '1', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.enableStep(0);
      await battlePass.grantPoints('50', owner.address);
      await battlePass.grantPoints('50', otherAccounts[0].address);

      await battlePass.claimStep(owner.address, 0);
      await expect(battlePass.claimStep(otherAccounts[0].address, 0)).to.be.revertedWith(
        'BattlePass: no items remaining',
      );
    });
    it('Should fail if the caller already claimed', async function () {
      const { battlePass, erc1155ItemType, erc1155, owner } = await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.enableStep(0);

      await battlePass.grantPoints('50', owner.address);
      await battlePass.claimStep(owner.address, 0);

      await expect(battlePass.claimStep(owner.address, 0)).to.be.revertedWith(
        'BattlePass: caller already claimed this step',
      );
    });
    it('Should claim all the items in the step', async function () {
      const { battlePass, erc1155, erc20, erc1155ItemType, erc20ItemType, otherAccounts } =
        await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 1, 2);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 2, 1);
      await battlePass.addItemToStep(0, erc20ItemType, erc20.address, '0', ethers.utils.parseEther('1'));
      await battlePass.enableStep(0);

      await battlePass.grantPoints('50', otherAccounts[0].address);
      await expect(battlePass.connect(otherAccounts[0]).claimStep(otherAccounts[0].address, 0))
        .to.emit(battlePass, 'ClaimStep')
        .withArgs('0', otherAccounts[0].address);

      const isClaimed = await battlePass.didAddressClaimStep(otherAccounts[0].address, 0);
      expect(isClaimed).to.be.true;

      const erc1155Balances = await erc1155.balanceOfBatch(
        [otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address],
        [0, 1, 2],
      );

      expect(erc1155Balances[0]).to.equal('5');
      expect(erc1155Balances[1]).to.equal('2');
      expect(erc1155Balances[2]).to.equal('1');

      const ercBalance = await erc20.balanceOf(otherAccounts[0].address);
      expect(ercBalance).to.equal(ethers.utils.parseEther('1'));
    });
    it('Should fail if the step requires premium but caller does not have it', async function () {
      const { battlePass, erc1155, erc1155ItemType, otherAccounts } = await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', true);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.enableStep(0);

      await battlePass.grantPoints('50', otherAccounts[0].address);
      await expect(battlePass.connect(otherAccounts[0]).claimStep(otherAccounts[0].address, 0)).to.be.revertedWith(
        'BattlePass: this step require a premium access',
      );

      const isClaimed = await battlePass.didAddressClaimStep(otherAccounts[0].address, 0);
      expect(isClaimed).to.be.false;
    });
    it('Should claim all the items in the premium step', async function () {
      const { battlePass, erc1155, erc20, erc1155ItemType, erc20ItemType, otherAccounts } =
        await loadFixture(deployFixture);

      await battlePass.createStep('50', '10', true);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 0, 5);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 1, 2);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, 2, 1);
      await battlePass.addItemToStep(0, erc20ItemType, erc20.address, '0', ethers.utils.parseEther('1'));
      await battlePass.enableStep(0);

      await battlePass.grantPremium(otherAccounts[0].address);
      await battlePass.grantPoints('50', otherAccounts[0].address);
      await expect(battlePass.connect(otherAccounts[0]).claimStep(otherAccounts[0].address, 0))
        .to.emit(battlePass, 'ClaimStep')
        .withArgs('0', otherAccounts[0].address);

      const isClaimed = await battlePass.didAddressClaimStep(otherAccounts[0].address, 0);
      expect(isClaimed).to.be.true;

      const erc1155Balances = await erc1155.balanceOfBatch(
        [otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address],
        [0, 1, 2],
      );

      expect(erc1155Balances[0]).to.equal('5');
      expect(erc1155Balances[1]).to.equal('2');
      expect(erc1155Balances[2]).to.equal('1');

      const ercBalance = await erc20.balanceOf(otherAccounts[0].address);
      expect(ercBalance).to.equal(ethers.utils.parseEther('1'));
    });
  });

  describe('getStepRemainingClaims', function () {
    it('Should fail if the step does not exist', async function () {
      const { battlePass } = await loadFixture(deployFixture);

      await expect(battlePass.getStepRemainingClaims(0)).to.be.revertedWith('BattlePass: step does not exist');
    });
    it('Should return the amount of claims left for a step', async function () {
      const { battlePass, owner, erc1155, erc1155ItemType } = await loadFixture(deployFixture);

      const claimsAmount = 50;
      const pointsRequired = 100;
      await battlePass.createStep(pointsRequired, claimsAmount, false);
      await battlePass.addItemToStep(0, erc1155ItemType, erc1155.address, '1', '5');
      await battlePass.enableStep(0);

      expect(await battlePass.getStepRemainingClaims(0)).to.equal(claimsAmount);

      await battlePass.grantPoints(pointsRequired, owner.address);
      await battlePass.claimStep(owner.address, 0);

      expect(await battlePass.getStepRemainingClaims(0)).to.equal(claimsAmount - 1);
    });
  });
});
