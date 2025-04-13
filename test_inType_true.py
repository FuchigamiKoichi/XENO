import module as m

def choice(now,choices,kind):
    out = {'now':now,'kind':kind,'choices':choices}
    choice = choices[0]
    return input(str(choice))

def test_inType_false_1():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card1,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_2():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card2,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_3():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card3,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_4():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card4,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_5():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card5,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_6():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card6,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_7():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card7,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_8():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card8,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_9():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card9,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'

def test_inType_false_10():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        if m.inType(type=m.Card10,list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'contain'