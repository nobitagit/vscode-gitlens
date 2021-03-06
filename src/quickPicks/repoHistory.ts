'use strict';
import { Iterables } from '../system';
import { CancellationTokenSource, QuickPickOptions, Uri, window } from 'vscode';
import { Commands, Keyboard, KeyNoopCommand } from '../commands';
import { GitUri, IGitLog } from '../gitProvider';
import { CommitQuickPickItem } from './gitQuickPicks';
import { CommandQuickPickItem, getQuickPickIgnoreFocusOut, showQuickPickProgress } from './quickPicks';

export class RepoHistoryQuickPick {

    static showProgress(maxCount?: number) {
        return showQuickPickProgress(`Loading repository history \u2014 ${maxCount ? ` limited to ${maxCount} commits` : ` this may take a while`}\u2026`,
            {
                left: KeyNoopCommand,
                ',': KeyNoopCommand,
                '.': KeyNoopCommand
            });
    }

    static async show(log: IGitLog, uri: GitUri, progressCancellation: CancellationTokenSource, goBackCommand?: CommandQuickPickItem, nextPageCommand?: CommandQuickPickItem): Promise<CommitQuickPickItem | CommandQuickPickItem | undefined> {
        const items = Array.from(Iterables.map(log.commits.values(), c => new CommitQuickPickItem(c, ` \u2014 ${c.fileNames}`))) as (CommitQuickPickItem | CommandQuickPickItem)[];

        let previousPageCommand: CommandQuickPickItem;

        if (log.truncated || uri.sha) {
            items.splice(0, 0, new CommandQuickPickItem({
                label: `$(sync) Show All Commits`,
                description: `\u00a0 \u2014 \u00a0\u00a0 this may take a while`
            }, Commands.ShowQuickRepoHistory, [Uri.file(uri.fsPath), 0, goBackCommand]));

            if (nextPageCommand) {
                items.splice(0, 0, nextPageCommand);
            }

            if (log.truncated) {
                const npc = new CommandQuickPickItem({
                    label: `$(arrow-right) Show Next Commits`,
                    description: `\u00a0 \u2014 \u00a0\u00a0 shows ${log.maxCount} newer commits`
                }, Commands.ShowQuickRepoHistory, [uri, log.maxCount, goBackCommand, undefined, nextPageCommand]);

                const last = Iterables.last(log.commits.values());

                previousPageCommand = new CommandQuickPickItem({
                    label: `$(arrow-left) Show Previous Commits`,
                    description: `\u00a0 \u2014 \u00a0\u00a0 shows ${log.maxCount} older commits`
                }, Commands.ShowQuickRepoHistory, [new GitUri(uri, last), log.maxCount, goBackCommand, undefined, npc]);

                items.splice(0, 0, previousPageCommand);
            }
        }

        if (goBackCommand) {
            items.splice(0, 0, goBackCommand);
        }

        if (progressCancellation.token.isCancellationRequested) return undefined;

        const scope = await Keyboard.instance.beginScope({
            left: goBackCommand,
            ',': previousPageCommand,
            '.': nextPageCommand
        });

        progressCancellation.cancel();

        const pick = await window.showQuickPick(items, {
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Search by commit message, filename, or sha',
            ignoreFocusOut: getQuickPickIgnoreFocusOut()
            // onDidSelectItem: (item: QuickPickItem) => {
            //     scope.setKeyCommand('right', item);
            // }
        } as QuickPickOptions);

        await scope.dispose();

        return pick;
    }
}