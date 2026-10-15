import {it,expect} from 'vitest';
import {isValidCompanionCount} from './registrationCompanions';
it('accepts optional blank, zero and whole companion counts',()=>{
 for(const value of ['',undefined,null,0,'0','2','20']) expect(isValidCompanionCount(value)).toBe(true);
});
it('rejects negative, fractional, exponent and unsafe counts',()=>{
 for(const value of ['-1','1.5','1e2','abc','9007199254740992']) expect(isValidCompanionCount(value)).toBe(false);
});
