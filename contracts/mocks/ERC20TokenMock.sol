// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// mock class using ERC20
contract ERC20TokenMock is ERC20 {
  constructor(
    string memory name_,
    string memory symbol_,
    address initialAccount,
    uint256 initialBalance
  ) payable ERC20(name_, symbol_) {
    _mint(initialAccount, initialBalance);
  }

  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }

  function burn(address account, uint256 amount) public {
    _burn(account, amount);
  }
}
