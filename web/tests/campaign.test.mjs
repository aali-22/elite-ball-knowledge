// The campaign tag a link of the site's own may carry (lib/campaign.mjs). Needs no server:
//   node --test tests/campaign.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPAIGNS, CONTENTS, MEDIUMS, SOURCES, campaignOf, hasTag, withoutTag } from '../lib/campaign.mjs';

test('a tag whose every part is on its list is kept, in a fixed order, and nothing else of the address is', () => {
  assert.equal(campaignOf('?sport=nba&utm_content=story&utm_campaign=gtm1&utm_medium=social&utm_source=instagram&f=x'),
    'utm_source=instagram&utm_medium=social&utm_campaign=gtm1&utm_content=story');
  for (const source of SOURCES) for (const medium of MEDIUMS) assert.equal(campaignOf(`?utm_source=${source}&utm_medium=${medium}`), `utm_source=${source}&utm_medium=${medium}`);
  for (const campaign of CAMPAIGNS) for (const content of CONTENTS) assert.match(campaignOf(`?utm_source=reddit&utm_medium=social&utm_campaign=${campaign}&utm_content=${content}`), new RegExp(`utm_campaign=${campaign}&utm_content=${content}$`));
});

test('capitals are folded', () => {
  assert.equal(campaignOf('?utm_source=Reddit&utm_medium=SOCIAL'), 'utm_source=reddit&utm_medium=social');
});

test('a source or a medium that is not on its list drops the whole tag', () => {
  for (const search of ['?utm_source=someone&utm_medium=social&utm_campaign=gtm1', '?utm_source=reddit&utm_medium=cpc', '?utm_source=reddit', '?utm_medium=social', '?utm_campaign=gtm1&utm_content=bio', '', '?sport=nba'])
    assert.equal(campaignOf(search), '', search);
});

test('a campaign or a content that is not on its list is dropped by itself', () => {
  assert.equal(campaignOf('?utm_source=bluesky&utm_medium=social&utm_campaign=someone%40example.com&utm_content=post'), 'utm_source=bluesky&utm_medium=social&utm_content=post');
  assert.equal(campaignOf('?utm_source=bluesky&utm_medium=social&utm_campaign=gtm1&utm_content=jane-doe-17'), 'utm_source=bluesky&utm_medium=social&utm_campaign=gtm1');
});

test('no other utm key and no click id is ever kept', () => {
  const kept = campaignOf('?utm_source=reddit&utm_medium=social&utm_term=a+person&utm_id=77&gclid=abc&fbclid=def&token=s3cret');
  assert.equal(kept, 'utm_source=reddit&utm_medium=social');
});

test('the lists are short words only: nothing on them could name a person or a post', () => {
  for (const word of [...SOURCES, ...MEDIUMS, ...CAMPAIGNS, ...CONTENTS]) assert.match(word, /^[a-z][a-z0-9]{1,11}$/);
  assert.ok(SOURCES.length <= 12 && MEDIUMS.length <= 6 && CAMPAIGNS.length <= 6 && CONTENTS.length <= 8);
});

test('the address bar loses every utm key and keeps the rest', () => {
  assert.equal(withoutTag('?sport=nba&utm_source=reddit&utm_medium=social&utm_term=x&f=clash%3Anba.pace'), '?sport=nba&f=clash%3Anba.pace');
  assert.equal(withoutTag('?utm_source=whoever&UTM_Medium=x'), '');
  assert.equal(withoutTag('?sport=nfl'), '?sport=nfl');
  assert.equal(hasTag('?sport=nba'), false);
  assert.equal(hasTag('?sport=nba&utm_term=x'), true);
});
