import { run } from '../functions/g2_voc';

describe('Test some function', () => {
  it('Something', () => {
    run([{
      payload: {
        work_created: {
          work: {
            id: 'some-id'
          }
        }
      }
    }]);
  });
});
