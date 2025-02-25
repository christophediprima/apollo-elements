import type { ResultOf } from '@graphql-typed-document-node/core';

import type * as C from '@apollo/client/core';

import * as S from '@apollo-elements/test/schema';

import * as E from './events';

import { ApolloError } from '@apollo/client/core';

import { ReactiveElement } from 'lit';

import { ApolloMutationController } from './apollo-mutation-controller';

import { defineCE, expect, fixture, nextFrame } from '@open-wc/testing';

import { match, spy, SinonSpy } from 'sinon';

import { setupClient, teardownClient } from '@apollo-elements/test';

describe('[core] ApolloMutationController', function() {
  describe('without mutation or options arguments', function() {
    let element: ReactiveElement & { mutation: ApolloMutationController<any>; };

    const handlers = {
      [E.ApolloControllerConnectedEvent.type]: spy(),
      [E.ApolloControllerDisconnectedEvent.type]: spy(),
    };

    const resetSpies = () => Object.values(handlers).forEach(h => h.resetHistory());

    afterEach(resetSpies);

    beforeEach(function() {
      for (const [type, handler] of Object.entries(handlers))
        window.addEventListener(type, handler);
    });

    afterEach(function() {
      for (const [type, handler] of Object.entries(handlers))
        window.removeEventListener(type, handler);
    });

    beforeEach(async function() {
      class MirroringHost extends ReactiveElement {
        mutation = new ApolloMutationController(this);
      }
      const tag = defineCE(MirroringHost);
      element = await fixture<MirroringHost>(`<${tag}></${tag}>`);
    });

    it('sets empty options', function() {
      expect(element.mutation.options).to.be.ok.and.to.be.empty;
    });

    it('fires event on connect', function() {
      const { type } = E.ApolloControllerConnectedEvent;
      const [event] = handlers[type].lastCall.args;
      expect(event.controller, 'controller').to.equal(element.mutation);
      expect(event.type, 'type').to.equal(type);
    });

    describe('when disconnecting', function() {
      beforeEach(resetSpies);
      beforeEach(() => element.remove());
      beforeEach(nextFrame);
      it('fires event on disconnect', function() {
        const { type } = E.ApolloControllerDisconnectedEvent;
        const [event] = handlers[type].lastCall.args;
        expect(event.controller, 'controller').to.equal(element.mutation);
        expect(event.type, 'type').to.equal(type);
      });
    });

    describe('with non-function onCompleted option', function() {
      beforeEach(function() {
        element.mutation.mutation = S.NoParamMutation;
        // @ts-expect-error: branches testing
        element.mutation.options.onCompleted = true;
      });
      it('calling mutate() does not throw', function() {
        expect(() => element.mutation.mutate()).to.not.throw;
      });
    });
  });

  describe('with global client', function() {
    beforeEach(setupClient);

    afterEach(teardownClient);

    describe('on a ReactiveElement that mirrors props', function() {
      class MirroringHost extends ReactiveElement {
        declare mutation: ApolloMutationController<any, any>;

        called = false;

        data?: this['mutation']['data'];

        error?: Error|ApolloError|null;

        loading?: boolean;

        updated() {
          this.called = this.mutation?.called ?? false;
          this.data = this.mutation?.data;
          this.error = this.mutation?.error;
          this.loading = this.mutation?.loading;
        }
      }

      describe('with NullableParamMutation', function() {
        let element: NullableParamMutationHost;

        class NullableParamMutationHost extends MirroringHost {
          declare shadowRoot: ShadowRoot;

          mutation = new ApolloMutationController(this, S.NullableParamMutation, {
            onCompleted: spy(),
            onError: spy(),
          });
        }

        beforeEach(async function define() {
          const tag = defineCE(class extends NullableParamMutationHost {});
          element = await fixture(`<${tag}></${tag}>`);
        });

        beforeEach(function() {
          spy(element.mutation.client!, 'mutate');
        });

        afterEach(function() {
          (element.mutation.client!.mutate as SinonSpy).restore();
        });

        describe('get mutation', function() {
          it('returns document', function() {
            expect(element.mutation.mutation).to.equal(element.mutation.document);
          });
          describe('set mutation', function() {
            beforeEach(() => element.mutation.variables = { nullable: '' });
            // @ts-expect-error: wrong mutation document!
            beforeEach(() => element.mutation.mutation = S.UpdateUserMutation);
            it('sets document', function() {
              expect(element.mutation.document).to.equal(S.UpdateUserMutation);
            });
          });
        });

        describe('get variables', function() {
          it('returns variables', function() {
            expect(element.mutation.variables).to.not.be.ok;
          });
          describe('set variables', function() {
            beforeEach(() => element.mutation.variables = { nullable: '' });
            it('sets variables', function() {
              expect(element.mutation.variables).to.deep.equal({ nullable: '' });
            });
          });
        });

        describe('calling mutate()', function() {
          let p: Promise<C.FetchResult<ResultOf<typeof element.mutation.mutation>>>;
          beforeEach(() => void (p = element.mutation.mutate()));
          it('sets loading', function() {
            expect(element.mutation.loading).to.be.true;
          });
          describe('after resolving', function() {
            beforeEach(() => p);
            beforeEach(nextFrame);
            it('unsets loading', function() {
              expect(element.mutation.loading).to.be.false;
            });
            it('sets data', function() {
              expect(element.data).to.be.ok.and.to.equal(element.mutation.data);
              expect(element.mutation.data?.nullableParam?.nullable).to.equal('Hello World');
            });
            it('calls onCompleted', function() {
              expect(element.mutation.options.onCompleted).to.have.been.calledWithMatch({
                nullableParam: {
                  nullable: 'Hello World',
                },
              });
            });
            describe('then calling mutate({ variables })', function() {
              beforeEach(() => element.mutation.mutate({ variables: { nullable: 'ניתן להריקה' } }));
              beforeEach(nextFrame);
              it('sets data', function() {
                expect(element.data).to.be.ok.and.to.equal(element.mutation.data);
                expect(element.mutation.data!.nullableParam?.nullable).to.equal('ניתן להריקה');
              });
              it('calls onCompleted', function() {
                expect(element.mutation.options.onCompleted).to.have.been.calledWithMatch({
                  nullableParam: {
                    nullable: 'ניתן להריקה',
                  },
                });
              });
            });
          });
        });

        describe('with ignoreResults option', function() {
          beforeEach(function() {
            element.mutation.options.ignoreResults = true;
          });
          describe('calling mutate()', function() {
            let p: Promise<C.FetchResult<ResultOf<typeof element.mutation.mutation>>>;
            beforeEach(() => void (p = element.mutation.mutate()));
            it('sets loading', function() {
              expect(element.mutation.loading).to.be.true;
            });
            describe('after resolving', function() {
              beforeEach(() => p);
              beforeEach(nextFrame);
              it('unsets loading', function() {
                expect(element.mutation.loading).to.be.false;
              });
              it('does not set data', function() {
                expect(element.data).to.not.be.ok;
              });
              it('does not call onCompleted', function() {
                expect(element.mutation.options.onCompleted).to.not.have.been.called;
              });
            });
          });
        });

        describe('with awaitRefetchQueries option', function() {
          const awaitRefetchQueries = true;
          beforeEach(function() {
            element.mutation.options.awaitRefetchQueries = awaitRefetchQueries;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with awaitRefetchQueries option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                awaitRefetchQueries,
              }));
            });
            describe('calling mutate({ awaitRefetchQueries })', function() {
              const awaitRefetchQueries = false;
              beforeEach(() => element.mutation.mutate({ awaitRefetchQueries }));
              it('calls client.mutate with provided awaitRefetchQueries', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  awaitRefetchQueries,
                });
              });
            });
          });
        });

        describe('with context option', function() {
          const context = {};
          beforeEach(function() {
            element.mutation.options.context = context;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with context option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                context,
              }));
            });
            describe('calling mutate({ context })', function() {
              const context = { hi: 'hi' };
              beforeEach(() => element.mutation.mutate({ context }));
              it('calls client.mutate with provided context', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  context,
                });
              });
            });
          });
        });

        describe('with errorPolicy option', function() {
          const errorPolicy = 'none';
          beforeEach(function() {
            element.mutation.options.errorPolicy = errorPolicy;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with errorPolicy option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                errorPolicy,
              }));
            });
            describe('calling mutate({ errorPolicy })', function() {
              const errorPolicy = 'all';
              beforeEach(() => element.mutation.mutate({ errorPolicy }));
              it('calls client.mutate with provided errorPolicy', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  errorPolicy,
                });
              });
            });
          });
        });

        describe('with fetchPolicy option', function() {
          const fetchPolicy = 'no-cache';
          beforeEach(function() {
            element.mutation.options.fetchPolicy = fetchPolicy;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with fetchPolicy option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                fetchPolicy,
              }));
            });
            describe('calling mutate({ fetchPolicy })', function() {
              const fetchPolicy = undefined;
              beforeEach(() => element.mutation.mutate({ fetchPolicy }));
              it('calls client.mutate with provided fetchPolicy', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  fetchPolicy,
                });
              });
            });
          });
        });

        describe('with optimisticResponse option', function() {
          const optimisticResponse = {
            nullableParam: {
              __typename: 'Nullable' as const,
              nullable: 'abelllnu',
            },
          };
          beforeEach(function() {
            element.mutation.options.optimisticResponse = optimisticResponse;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with optimisticResponse option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                optimisticResponse,
              }));
            });
            describe('calling mutate({ optimisticResponse })', function() {
              const optimisticResponse = {
                nullableParam: {
                  __typename: 'Nullable' as const,
                  nullable: 'nullable',
                },
              };
              beforeEach(() => element.mutation.mutate({ optimisticResponse }));
              it('calls client.mutate with provided optimisticResponse', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  optimisticResponse,
                });
              });
            });
          });
        });

        describe('with refetchQueries option', function() {
          const refetchQueries = ['A', 'B', 'E'];
          beforeEach(function() {
            element.mutation.options.refetchQueries = refetchQueries;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with refetchQueries option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                refetchQueries,
              }));
            });
            describe('calling mutate({ refetchQueries })', function() {
              const refetchQueries = ['D', 'E', 'F'];
              beforeEach(() => element.mutation.mutate({ refetchQueries }));
              it('calls client.mutate with provided refetchQueries', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  refetchQueries,
                });
              });
            });
          });
        });

        describe('with update option', function() {
          const update = () => void 0;
          beforeEach(function() {
            element.mutation.options.update = update;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with update option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                update,
              }));
            });
            describe('calling mutate({ update })', function() {
              const update = () => void false;
              beforeEach(() => element.mutation.mutate({ update }));
              it('calls client.mutate with provided update', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  update,
                });
              });
            });
          });
        });

        describe('with variables', function() {
          const variables = { nullable: 'variable' };
          beforeEach(function() {
            element.mutation.variables = variables;
          });
          describe('calling mutate()', function() {
            beforeEach(() => element.mutation.mutate());
            it('calls client.mutate with variables option', function() {
              expect(element.mutation.client!.mutate).to.have.been.calledOnceWith(match({
                variables,
              }));
            });
            describe('calling mutate({ variables })', function() {
              const variables = { nullable: 'aabeilrv' };
              beforeEach(() => element.mutation.mutate({ variables }));
              it('calls client.mutate with provided variables', function() {
                expect(element.mutation.client!.mutate).to.have.been.calledWithMatch({
                  variables,
                });
              });
            });
          });
        });

        describe('when mutate({ variables }) rejects', function() {
          let err: Error;
          beforeEach(() => (element.mutation.options.onCompleted! as SinonSpy).resetHistory());
          beforeEach(() =>
            element.mutation
              .mutate({ variables: { nullable: 'error' } })
              .catch(e => err = e));
          beforeEach(nextFrame);
          it('unsets data', function() {
            expect(element.data).to.not.be.ok;
          });
          it('does not call onCompleted', function() {
            expect(element.mutation.options.onCompleted).to.not.have.been.called;
          });
          it('calls onError', function() {
            expect(element.mutation.options.onError).to.have.been.calledWith(err);
          });
          it('sets error', function() {
            expect(element.mutation.error!.message, 'message').to.equal('error');
            expect(element.mutation.error, 'instanceof ApolloError')
              .to.be.an.instanceof(ApolloError);
            expect(element.mutation.error?.graphQLErrors, 'ApolloError interface')
              .to.be.an.instanceof(Array);
          });
        });

        describe('destructuring mutate', function() {
          let mutate: (typeof element.mutation)['mutate'];
          let p: Promise<C.FetchResult<ResultOf<typeof element.mutation.mutation>>>;
          beforeEach(() => (element.mutation.options.onCompleted! as SinonSpy).resetHistory());
          beforeEach(() => ({ mutate } = element.mutation));
          beforeEach(() => void (p = mutate()));
          beforeEach(() => p);
          it('calls onCompleted', function() {
            expect(element.mutation.options.onCompleted).to.have.been.called;
          });
          it('sets called', function() {
            expect(element.mutation.called).to.be.true;
          });
        });
      });
    });
  });
});
