#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, symbol_short};

#[contract]
pub struct TalkingContracts;

#[contractimpl]
impl TalkingContracts {
    pub fn talk(env: Env, me: Address, msg: Symbol) {
        me.require_auth();
        env.events().publish((me.clone(),), msg);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events}, Address, Env};

    #[test]
    fn test_print_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, TalkingContracts);
        let client = TalkingContractsClient::new(&env, &contract_id);
        let user = Address::generate(&env);
        env.mock_all_auths();
        let msg: Symbol = symbol_short!("Hello");
        client.talk(&user, &msg);
        let events = env.events().all();
        assert_eq!(events.len(), 1);
    }
}
