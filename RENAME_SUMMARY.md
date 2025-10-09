# テストファイル名簡潔化完了

## リネーム結果

| 旧ファイル名 | 新ファイル名 | 用途 |
|-------------|-------------|------|
| `idealAnimation.test.js` | `animation.test.js` | GSAPベースアニメーションテスト |
| `idealAudio.test.js` | `audio.test.js` | AudioManagerクラステスト |
| `idealGameService.test.js` | `game.test.js` | ゲームロジック・カード効果テスト |
| `idealIntegration.test.js` | `integration.test.js` | エンドツーエンド統合テスト |
| `idealSocketHandlers.test.js` | `socket.test.js` | Socket.IO通信テスト |
| `cardSpecificIssues.test.js` | `cardIssues.test.js` | カード特有問題のテスト |
| `idealSpec.js` | `spec.js` | 理想仕様定義 |

## 修正した参照

以下のファイル内でimport/require文を修正：
- `integration.test.js`
- `game.test.js` 
- `socket.test.js`

```javascript
// 修正前
} = require('./idealSpec');

// 修正後
} = require('./spec');
```

## テスト実行結果

- **総テスト数**: 126件
- **成功率**: 100% (126/126) ✅
- **テストスイート**: 6ファイル (すべて合格)

すべてのテストファイルが正常に動作することを確認済み。