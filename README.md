# On chain battle pass

This is the `BattlePass` contract. It allows you to load ERC20/ERC1155 items into a contract and to distribute them to addresses that have accumulated enough points to reach step thresholds. You can allow other contracts to grant points to any address by adding them the the manager's list.

## How to use

* Run `npx hardhat run scripts/deploy.ts`
* Create a step using `createStep` with:
  * How many points are required to claim that stepp
  * How many times the step can be claimed before it ruins out of items (Note: you will need to have the items in your wallet in order to activate the step later)
  * Is a premium access required to claim the step
* Add as many items as you want in the step using `addItemToStep` (the more items in a step, the more gas required to activae and claim it, so be careful) with:
  * The index of the step to which you wnat to add the item to
  * The type of the item (0 = ERC, 1 = ERC1155)
  * The address of the contract of the item
  * The token ID of the item (only used for ERC1155 items)
  * The amount of that item to be given when an address claims the step
* Activate the step with `activateStep` with:
  * The index of the step to activate
  * NOTE: This action cannot be undone and signal that the step is ready to be claimed, so make sure your step is well configured
  * NOTE 2: This method will take all of the items required by the step from your wallet, so make sure you approved the battle pass address in each of the item's contract

### Optional

* If your battlepass takes advantage of the premium access manager, you can set the price of the premium access with `setPremiumPrice` with:
  * The price in **wei**
  * NOTE: The premium access cannot be bought unless the price is set to a number higher than 0
  * NOTE 2: You can remove the possibility to buy the premium access by setting the price to 0
