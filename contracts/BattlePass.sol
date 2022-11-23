// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import "./PremiumAccessManager.sol";

/// @title Battle pass system used in video games for on chain rewards.
/// @author KirienzoEth
contract BattlePass is PremiumAccessManager, ERC1155Holder {
  event GrantPoints(uint256 _amount, address _to);
  event SetManagerStatus(address _address, bool _status);
  event CreateStep(uint256 _index, uint256 _pointsRequired, uint256 _claimsAmount, bool _isPremiumRequired);
  event ActivateStep(uint256 _index);
  event ClaimStep(uint256 _index, address _address);
  event AddItemToStep(
    uint256 _stepIndex,
    uint256 _itemIndex,
    ItemType _type,
    address _contractAddress,
    uint256 _tokenId,
    uint256 _amount
  );

  enum ItemType {
    ERC20,
    ERC1155
  }

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

  /// One step of the battle pass that grant prizes
  struct Step {
    uint256 pointsRequired;
    uint256 itemsAmount;
    uint256 claimsAmount;
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

  constructor() {
    isManager[_msgSender()] = true;
  }

  /// @dev Throws if called by any account that is not a manager
  modifier onlyManager() {
    require(isManager[_msgSender()], "BattlePass: caller is not a manager");
    _;
  }

  function grantPoints(uint256 _amount, address _to) public onlyManager {
    balanceOf[_to] += _amount;

    emit GrantPoints(_amount, _to);
  }

  function setManagerStatus(address _address, bool _status) public onlyOwner {
    isManager[_address] = _status;

    emit SetManagerStatus(_address, _status);
  }

  function createStep(
    uint256 _pointsRequired,
    uint256 _claimsAmount,
    bool _isPremiumRequired
  ) public onlyOwner {
    _steps[stepsAmount] = Step(_pointsRequired, 0, _claimsAmount, _isPremiumRequired, false);

    emit CreateStep(stepsAmount++, _pointsRequired, _claimsAmount, _isPremiumRequired);
  }

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

  function getStep(uint256 _index) public view returns (Step memory) {
    require(_index < stepsAmount, "BattlePass: step does not exist");

    return _steps[_index];
  }

  function getItemOfStep(uint256 _stepIndex, uint256 _itemIndex) public view returns (Item memory) {
    require(_itemIndex < getStep(_stepIndex).itemsAmount, "BattlePass: item in step does not exist");

    return _itemsOfStep[_stepIndex][_itemIndex];
  }

  function activateStep(uint256 _stepIndex) public onlyOwner {
    Step memory _step = getStep(_stepIndex);
    require(!_step.isClaimable, "BattlePass: step was already activated");

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

    emit ActivateStep(_stepIndex);
  }

  function claimStep(uint256 _stepIndex) public {
    Step memory _step = getStep(_stepIndex);
    require(_step.isClaimable, "BattlePass: step is not claimable");
    require(!didAddressClaimStep[_msgSender()][_stepIndex], "BattlePass: caller already claimed this step");
    require(balanceOf[_msgSender()] >= _step.pointsRequired, "BattlePass: caller does not have enough points");

    if (_step.isPremiumRequired) {
      require(hasPremium[_msgSender()], "BattlePass: this step require a premium access");
    }

    didAddressClaimStep[_msgSender()][_stepIndex] = true;

    for (uint _i = 0; _i < _step.itemsAmount; _i++) {
      Item memory _item = _itemsOfStep[_stepIndex][_i];
      if (_item.itemType == ItemType.ERC20) {
        IERC20(_item.contractAddress).transfer(_msgSender(), _item.amount);
      } else {
        IERC1155(_item.contractAddress).safeTransferFrom(address(this), _msgSender(), _item.tokenId, _item.amount, "");
      }
    }

    emit ClaimStep(_stepIndex, _msgSender());
  }
}
