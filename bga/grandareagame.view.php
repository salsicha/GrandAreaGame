<?php
/**
 * Standard BGA view: fills the template placeholders for the game page.
 */

require_once APP_BASE_PATH . 'view/common/game.view.php';

class view_grandareagame_grandareagame extends game_view
{
    public function getGameName()
    {
        return 'grandareagame';
    }

    public function build_page($viewArgs)
    {
        $this->tpl['GRANDAREA_TITLE'] = self::_('Grand Area');
        $this->tpl['LABEL_ACTION'] = self::_('Action');
        $this->tpl['LABEL_TARGET'] = self::_('Target');
        $this->tpl['LABEL_FRAMING'] = self::_('Framing (Social Capital)');
        $this->tpl['LABEL_COMMIT'] = self::_('Commit secret action');
        $this->tpl['LABEL_REVEAL'] = self::_('Reveal committed action');
        $this->tpl['LABEL_END_TURN'] = self::_('End turn');
    }
}
