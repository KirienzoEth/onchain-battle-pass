// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import "./PremiumAccessManager.sol";

/// @title Battle pass system used in video games for on chain rewards.
/// @author KirienzoEth
contract BattlePass is PremiumAccessManager, ERC1155Holder {
  enum ItemType {
    ERC20,
    ERC1155
  }

  /// One step of the battle pass that grant prizes
  struct Step {
    uint64 pointsRequired;
    uint32 itemsAmount;
    uint32 claimsAmount;
    bool isPremiumRequired;
    bool isClaimable;
  }

  /// Item to be distributed in steps
  struct Item {
    ItemType itemType;
    address contractAddress;
    /// Only used for ERC1155
    uint256 tokenId;
    uint256 amount;
  }

  event GrantPoints(uint256 _amount, address _to);
  event SetManagerStatus(address _address, bool _status);
  event CreateStep(uint256 _index, uint256 _pointsRequired, uint256 _claimsAmount, bool _isPremiumRequired);
  event EnableStep(uint256 _index);
  event ClaimStep(uint256 _index, address _address);
  event AddItemToStep(
    uint256 _stepIndex,
    uint256 _itemIndex,
    ItemType _type,
    address _contractAddress,
    uint256 _tokenId,
    uint256 _amount
  );

  /// Returns the number of points an address accumulated
  mapping(address => uint256) public balanceOf;
  /// Returns true if an address is allowed to grant points
  mapping(address => bool) public isManager;
  /// Returns the number of steps in the battle pass
  uint256 public stepsAmount;
  /// Returns true if an address already claimed the items of a step
  mapping(address => mapping(uint256 => bool)) public didAddressClaimStep;

  /// All of the steps set in the battle pass
  mapping(uint256 => Step) private _steps;
  /// All of the items added in a step
  mapping(uint256 => mapping(uint256 => Item)) private _itemsOfStep;

  constructor() {
    isManager[_msgSender()] = true;
  }

  /// @dev Throws if called by any account that is not a manager
  modifier onlyManager() {
    require(isManager[_msgSender()], "BattlePass: caller is not a manager");
    _;
  }

  /// @notice Grants `_amount` points to `_to`
  function grantPoints(uint256 _amount, address _to) public onlyManager {
    balanceOf[_to] += _amount;

    emit GrantPoints(_amount, _to);
  }

  /// @notice Add/Remove the manager status of an address
  /// @param _address Address to change the status of
  /// @param _status New status of the address
  function setManagerStatus(address _address, bool _status) public onlyOwner {
    isManager[_address] = _status;

    emit SetManagerStatus(_address, _status);
  }

  /// @notice Create a new step
  /// @param _pointsRequired Points required to claim the step
  /// @param _claimsAmount How many claims the step can support
  /// @param _isPremiumRequired Is a premium access required to claim the step
  function createStep(uint64 _pointsRequired, uint32 _claimsAmount, bool _isPremiumRequired) public onlyOwner {
    _steps[stepsAmount] = Step(_pointsRequired, 0, _claimsAmount, _isPremiumRequired, false);

    emit CreateStep(stepsAmount++, _pointsRequired, _claimsAmount, _isPremiumRequired);
  }

  /// @notice Add an item to the step stored at the provided index
  /// @param _stepIndex Index of the step to add the item to
  /// @param _type type of the item to add
  /// @param _itemContractAddress contract address of the item to add
  /// @param _itemTokenId Token ID of the item to add
  /// @param _itemAmount Amount of items to add
  function addItemToStep(
    uint256 _stepIndex,
    ItemType _type,
    address _itemContractAddress,
    uint256 _itemTokenId,
    uint256 _itemAmount
  ) public onlyOwner {
    Step memory _step = getStep(_stepIndex);
    _itemsOfStep[_stepIndex][_step.itemsAmount] = Item(_type, _itemContractAddress, _itemTokenId, _itemAmount);

    emit AddItemToStep(_stepIndex, _step.itemsAmount, _type, _itemContractAddress, _itemTokenId, _itemAmount);

    _steps[_stepIndex].itemsAmount++;
  }

  /// @notice Returns the step stored at the provided index
  function getStep(uint256 _index) public view returns (Step memory) {
    require(_index < stepsAmount, "BattlePass: step does not exist");

    return _steps[_index];
  }

  /// @notice Returns the item stored at the provided index in the provided step
  function getItemOfStep(uint256 _stepIndex, uint256 _itemIndex) public view returns (Item memory) {
    require(_itemIndex < getStep(_stepIndex).itemsAmount, "BattlePass: item in step does not exist");

    return _itemsOfStep[_stepIndex][_itemIndex];
  }

  /// @notice Makes the step claimable and send all of the prizes to this contract
  /// @dev If the TX does not run out of gas, claimStep shouldn't either
  /// @param _stepIndex The index of the step to enable
  function enableStep(uint256 _stepIndex) public onlyOwner {
    Step memory _step = getStep(_stepIndex);
    require(!_step.isClaimable, "BattlePass: step was already enabled");

    for (uint _i = 0; _i < _step.itemsAmount; _i++) {
      Item memory _item = _itemsOfStep[_stepIndex][_i];
      if (_item.itemType == ItemType.ERC20) {
        IERC20(_item.contractAddress).transferFrom(_msgSender(), address(this), _step.claimsAmount * _item.amount);
      } else {
        IERC1155(_item.contractAddress).safeTransferFrom(
          _msgSender(),
          address(this),
          _item.tokenId,
          _step.claimsAmount * _item.amount,
          ""
        );
      }
    }

    _steps[_stepIndex].isClaimable = true;

    emit EnableStep(_stepIndex);
  }

  /// @notice Claim the rewards for step `_stepIndex` if `_address` has enough points
  /// @param _address Address of the user to send the prizes to
  /// @param _stepIndex Index of the step to claim
  function claimStep(address _address, uint256 _stepIndex) public {
    Step memory _step = getStep(_stepIndex);
    require(_step.isClaimable, "BattlePass: step is not claimable");
    require(!didAddressClaimStep[_address][_stepIndex], "BattlePass: caller already claimed this step");
    require(balanceOf[_address] >= _step.pointsRequired, "BattlePass: caller does not have enough points");

    if (_step.isPremiumRequired) {
      require(hasPremium[_address], "BattlePass: this step require a premium access");
    }

    didAddressClaimStep[_address][_stepIndex] = true;

    // If the `enableStep` TX did not run out of gas, this shouldn't either
    for (uint _i = 0; _i < _step.itemsAmount; ++_i) {
      Item memory _item = _itemsOfStep[_stepIndex][_i];
      if (_item.itemType == ItemType.ERC20) {
        IERC20(_item.contractAddress).transfer(_address, _item.amount);
      } else {
        IERC1155(_item.contractAddress).safeTransferFrom(address(this), _address, _item.tokenId, _item.amount, "");
      }
    }

    emit ClaimStep(_stepIndex, _address);
  }
}
