// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title ERC1155TokenMock
 * This mock just publicizes internal functions for testing purposes
 */
contract ERC1155TokenMock is ERC1155 {
  using Address for address;

  constructor(string memory _uri) ERC1155(_uri) {}

  function setURI(string memory newuri) public {
    _setURI(newuri);
  }

  function mint(address to, uint256 id, uint256 value, bytes memory data) public {
    _mint(to, id, value, data);
  }

  function mintBatch(address to, uint256[] memory ids, uint256[] memory values, bytes memory data) public {
    _mintBatch(to, ids, values, data);
  }

  function burn(address owner, uint256 id, uint256 value) public {
    _burn(owner, id, value);
  }

  function burnBatch(address owner, uint256[] memory ids, uint256[] memory values) public {
    _burnBatch(owner, ids, values);
  }

  function unsafeTransferFrom(
    address operator,
    address from,
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) public {
    if (to.isContract()) {
      try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
        if (response != IERC1155Receiver(to).onERC1155Received.selector) {
          revert("ERC1155: ERC1155Receiver rejected tokens");
        }
      } catch Error(string memory reason) {
        revert(reason);
      } catch {
        revert("ERC1155: transfer to non ERC1155Receiver implementer");
      }
    }
  }
}
