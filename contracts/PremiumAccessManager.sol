// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @title Contract to manage the premium access of the battle pass
/// @author KirienzoEth
contract PremiumAccessManager is Ownable {
  event SetPremiumPrice(uint256 _price);
  event GetPremium(address _address);

  /// Returns the price of the premium access
  uint256 public premiumPrice;
  /// Returns true if an address paird for premium access
  mapping(address => bool) public hasPremium;

  function setPremiumPrice(uint256 _price) public onlyOwner {
    premiumPrice = _price;

    emit SetPremiumPrice(_price);
  }

  /// @notice Grant premium access to `_address`
  function grantPremium(address _address) public onlyOwner {
    hasPremium[_address] = true;

    emit GetPremium(_address);
  }

  /// @notice Buy premium access
  /// @dev Cannot be used if premium price is 0, msg.sender already has premium or value sent is different from premium price
  function buyPremium() public payable {
    require(premiumPrice != 0, "BattlePass: premium price cannot be 0");
    require(!hasPremium[_msgSender()], "BattlePass: caller already has premium");
    require(msg.value == premiumPrice, "BattlePass: wrong value sent");

    hasPremium[_msgSender()] = true;

    emit GetPremium(_msgSender());
  }
}
